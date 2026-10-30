// Captures every Storybook story as PNGs, and compares two captures pixel for pixel, so a change
// that should draw nothing new can be shown to draw nothing new.
//
//   node scripts/visual-check.ts <label> [--url <storybook>] [--static <dir> [--port <n>]]
//                                        [--style <id>] [--filter <text>] [--jobs <n>]
//   node scripts/visual-check.ts --compare <a> <b>
//
// A capture opens each story's iframe at 1280×800 under a fine and a coarse pointer, light and
// dark, and writes .tmp/visual/<label>/<story>@<pointer>-<mode>.png. It builds nothing: --url
// names a running Storybook (default http://localhost:6006), --static a built one it serves
// itself on --port (default 6199; two captures compared must use the same one). A comparison writes .tmp/visual/compare-<a>-<b>/ (report.md and a diff image per story
// that differs) and exits 1 when any story differs.
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import pngjs from "pngjs";

const { PNG } = pngjs;
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, ".tmp/visual");
const WIDTH = 1280;
const HEIGHT = 800;
// A story taller than this is cut here; nothing in the catalogue comes close.
const MAX_HEIGHT = 4000;
const DEFAULT_THEME = "default";
const VARIANTS = [
  { pointer: "fine", mode: "light" },
  { pointer: "fine", mode: "dark" },
  { pointer: "coarse", mode: "light" },
  { pointer: "coarse", mode: "dark" },
] as const;

// Runs in every frame before any of the page's scripts: no transitions, no blinking caret, a
// clock that starts at one instant, so "3 hours ago" reads the same next week, and a seeded
// Math.random, so a diagram drawn with jitter (mermaid's) jitters the same way each run.
// Animations are settled before each screenshot (SETTLE).
const FREEZE = `(() => {
  const css = "*, *::before, *::after { transition: none !important; caret-color: transparent !important; }";
  const add = () => {
    const style = document.createElement("style");
    style.textContent = css;
    document.documentElement.append(style);
  };
  if (document.documentElement) add();
  else document.addEventListener("DOMContentLoaded", add);
  const Real = Date;
  const shift = Real.UTC(2026, 0, 15, 12) - Real.now();
  class FrozenDate extends Real {
    constructor(...args) {
      if (args.length === 0) super(Real.now() + shift);
      else super(...args);
    }
    static now() {
      return Real.now() + shift;
    }
  }
  globalThis.Date = FrozenDate;
  let seed = 0x2f6b9a1d;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

interface Story {
  id: string;
  title: string;
  name: string;
}

interface Options {
  label: string;
  url: string | undefined;
  staticDir: string | undefined;
  port: number;
  style: string | undefined;
  filter: string | undefined;
  jobs: number;
}

function parseArgs(argv: string[]): { compare: [string, string] } | Options {
  const flags = new Map<string, string>();
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--compare") return { compare: [argv[i + 1], argv[i + 2]] };
    if (arg.startsWith("--")) flags.set(arg.slice(2), argv[++i]);
    else rest.push(arg);
  }
  if (rest.length !== 1) {
    throw new Error(
      "usage: visual-check.ts <label> [--url u] [--static dir] [--style id] [--filter t] [--jobs n] | --compare <a> <b>",
    );
  }
  return {
    label: rest[0],
    url: flags.get("url"),
    staticDir: flags.get("static"),
    port: Number(flags.get("port") ?? 6199),
    style: flags.get("style"),
    filter: flags.get("filter"),
    jobs: Number(flags.get("jobs") ?? 4),
  };
}

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".wasm": "application/wasm",
};

function serve(
  dir: string,
  port: number,
): Promise<{ url: string; server: Server }> {
  const server = createServer((req, res) => {
    const path = normalize(
      decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname),
    );
    let file = join(dir, path);
    if (!file.startsWith(dir) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    if (path.endsWith("/")) file = join(file, "index.html");
    res.writeHead(200, {
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    });
    res.end(readFileSync(file));
  });
  // One port every time: a story that prints its own URL (useViewHref's) draws the same pixels.
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () =>
      resolve({ url: `http://127.0.0.1:${port}`, server }),
    );
  });
}

/** One DevTools connection to the browser; each tab is a flat session on it. */
class Cdp {
  #ws: WebSocket;
  #next = 1;
  #pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  #listeners = new Set<
    (method: string, params: unknown, sessionId?: string) => void
  >();

  private constructor(ws: WebSocket) {
    this.#ws = ws;
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== undefined) {
        const pending = this.#pending.get(message.id);
        this.#pending.delete(message.id);
        if (message.error) pending?.reject(new Error(message.error.message));
        else pending?.resolve(message.result);
      } else {
        for (const listener of this.#listeners) {
          listener(message.method, message.params, message.sessionId);
        }
      }
    });
  }

  static open(url: string): Promise<Cdp> {
    const ws = new WebSocket(url);
    return new Promise((resolve, reject) => {
      ws.addEventListener("open", () => resolve(new Cdp(ws)));
      ws.addEventListener("error", () =>
        reject(new Error(`cannot reach ${url}`)),
      );
    });
  }

  send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
  ): Promise<T> {
    const id = this.#next++;
    this.#ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => {
      // A story that hangs its renderer answers nothing; its tab is replaced.
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`${method}: no answer after 30s`));
      }, 30_000);
      this.#pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });
  }

  on(listener: (method: string, params: unknown, sessionId?: string) => void) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  close() {
    this.#ws.close();
  }
}

async function launchChromium(): Promise<{ cdp: Cdp; kill: () => void }> {
  // A profile per run: two captures at once (a baseline and a change) must not share one.
  const profile = join(OUT, `.profile-${process.pid}`);
  mkdirSync(profile, { recursive: true });
  const child = spawn(
    process.env.CHROMIUM ?? "/usr/bin/chromium",
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--font-render-hinting=none",
      "--disable-gpu",
      // Rasterize in one pass on one thread: tiles rastered in parallel, or partially,
      // place an edge at a fractional position a pixel apart from one run to the next.
      "--num-raster-threads=1",
      "--disable-partial-raster",
      "--run-all-compositor-stages-before-draw",
      "--disable-checker-imaging",
      "--disable-lcd-text",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const endpoint = await new Promise<string>((resolve, reject) => {
    let log = "";
    child.stderr.on("data", (chunk: Buffer) => {
      log += chunk.toString();
      const match = /DevTools listening on (ws:\S+)/.exec(log);
      if (match) resolve(match[1]);
    });
    child.on("exit", (code) =>
      reject(new Error(`chromium exited ${code}\n${log}`)),
    );
  });
  return {
    cdp: await Cdp.open(endpoint),
    kill: () => {
      // Its helper processes may still be writing as the browser exits; a profile left behind
      // is only disk under .tmp/.
      child.once("exit", () => {
        try {
          rmSync(profile, { recursive: true, force: true });
        } catch {}
      });
      child.kill();
    },
  };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A tab: one target and its session. */
async function openTab(cdp: Cdp) {
  const { targetId } = await cdp.send<{ targetId: string }>(
    "Target.createTarget",
    {
      url: "about:blank",
    },
  );
  const { sessionId } = await cdp.send<{ sessionId: string }>(
    "Target.attachToTarget",
    {
      targetId,
      flatten: true,
    },
  );
  const send = <T = Record<string, unknown>>(
    method: string,
    params?: Record<string, unknown>,
  ) => cdp.send<T>(method, params, sessionId);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: FREEZE });
  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Emulation.setTimezoneOverride", { timezoneId: "UTC" });
  await send("Emulation.setLocaleOverride", { locale: "en-US" });
  const evaluate = async <T>(expression: string): Promise<T> => {
    const { result } = await send<{ result: { value: T } }>(
      "Runtime.evaluate",
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
      },
    );
    return result.value;
  };
  // Counted in the page: the Network domain, enabled on a story that streams a large log,
  // stalls the renderer for minutes.
  const networkIdle = (quietMs: number, timeoutMs: number) =>
    evaluate(`new Promise((resolve) => {
      const start = performance.now();
      let count = -1;
      let since = start;
      const tick = () => {
        const now = performance.now();
        const next = performance.getEntriesByType("resource").length;
        if (next !== count) {
          count = next;
          since = now;
        }
        if (now - since >= ${quietMs} || now - start >= ${timeoutMs}) resolve(true);
        else setTimeout(tick, 50);
      };
      tick();
    })`);
  return {
    send,
    evaluate,
    networkIdle,
    close: () => cdp.send("Target.closeTarget", { targetId }),
  };
}

type Tab = Awaited<ReturnType<typeof openTab>>;

// A finite animation (an overlay's enter) jumps to its end; an infinite one (a spinner, a pulse)
// is cancelled, which leaves the element as it is drawn at rest.
const SETTLE = `(() => {
  for (const animation of document.getAnimations()) {
    const timing = animation.effect?.getComputedTiming();
    if (timing && timing.iterations !== Infinity) animation.finish();
    else animation.cancel();
  }
  return true;
})()`;

// Storybook's own render phases; a story is ready once its render, and any play function, is over.
const READY = `(() => {
  const render = window.__STORYBOOK_PREVIEW__?.currentRender;
  const phase = render?.phase;
  return ["completed", "finished", "errored", "aborted"].includes(phase) ||
    document.body.classList.contains("sb-show-errordisplay");
})()`;

async function screenshot(tab: Tab): Promise<Buffer> {
  await tab.evaluate(SETTLE);
  // An opacity or transform animation runs on the compositor, which shows the pause only once
  // the main thread has committed a frame.
  await tab.evaluate(
    "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))",
  );
  const height = await tab.evaluate<number>(
    "Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)",
  );
  const clip = {
    x: 0,
    y: 0,
    width: WIDTH,
    height: Math.min(Math.max(height, HEIGHT), MAX_HEIGHT),
    scale: 1,
  };
  const { data } = await tab.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
    clip,
    captureBeyondViewport: clip.height > HEIGHT,
  });
  return Buffer.from(data, "base64");
}

async function capture(
  tab: Tab,
  base: string,
  story: Story,
  variant: (typeof VARIANTS)[number],
  style: string | undefined,
) {
  const globals = [
    `theme:${DEFAULT_THEME}_${variant.mode}`,
    `pointer:${variant.pointer}`,
  ];
  const url = `${base}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story&globals=${globals.join(";")}`;
  await tab.send("Page.navigate", { url });
  const start = Date.now();
  while (!(await tab.evaluate<boolean>(READY))) {
    if (Date.now() - start > 30_000)
      throw new Error(`${story.id}: not rendered after 30s`);
    await delay(50);
  }
  if (style !== undefined) {
    await tab.evaluate(
      `document.documentElement.dataset.style = ${JSON.stringify(style)}`,
    );
  }
  await tab.evaluate("document.fonts.ready.then(() => true)");
  await tab.networkIdle(300, 10_000);
  // A story that settles over several frames (a measured layout, a lazy chunk, an async
  // highlighter) is caught once three screenshots in a row agree: under eight tabs' load a
  // worker can sit still for one interval and still have a diff to draw.
  let previous = await screenshot(tab);
  let agreeing = 0;
  for (let attempt = 0; attempt < 16; attempt++) {
    await delay(400);
    await tab.evaluate("document.fonts.ready.then(() => true)");
    await tab.networkIdle(300, 5_000);
    const next = await screenshot(tab);
    agreeing = next.equals(previous) ? agreeing + 1 : 0;
    if (agreeing === 2) return { png: next, stable: true };
    previous = next;
  }
  return { png: previous, stable: false };
}

/** The captures that never settled, which a comparison reports apart. */
const UNSTABLE = "unstable.txt";

function readUnstable(dir: string): Set<string> {
  try {
    return new Set(
      readFileSync(join(dir, UNSTABLE), "utf8").split("\n").filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

const fileOf = (id: string, variant: (typeof VARIANTS)[number]) =>
  `${id}@${variant.pointer}-${variant.mode}.png`;

async function runCapture(options: Options) {
  let base = options.url ?? "http://localhost:6006";
  let server: Server | undefined;
  if (options.staticDir !== undefined) {
    ({ url: base, server } = await serve(
      join(process.cwd(), options.staticDir),
      options.port,
    ));
  }
  base = base.replace(/\/$/, "");
  const index = (await (await fetch(`${base}/index.json`)).json()) as {
    entries: Record<string, Story & { type: string }>;
  };
  const stories = Object.values(index.entries).filter(
    (entry) =>
      entry.type === "story" &&
      (options.filter === undefined || entry.id.includes(options.filter)),
  );
  const dir = join(OUT, options.label);
  mkdirSync(dir, { recursive: true });
  const jobs = stories.flatMap((story) =>
    VARIANTS.map((variant) => ({ story, variant })),
  );
  console.log(`${stories.length} stories, ${jobs.length} captures → ${dir}`);

  const { cdp, kill } = await launchChromium();
  let done = 0;
  let failures: string[] = [];
  // A story that hangs its renderer stalls the whole browser for a while, failing whatever
  // ran beside it; those get a second go, one at a time, once everything else is done.
  const retries: typeof jobs = [];
  // A filtered run keeps what the earlier, wider one found about the other stories.
  const unstable = readUnstable(dir);
  try {
    const worker = async (queue: typeof jobs, retry: boolean) => {
      let tab = await openTab(cdp);
      for (let job = queue.shift(); job !== undefined; job = queue.shift()) {
        const name = fileOf(job.story.id, job.variant);
        try {
          const { png, stable } = await capture(
            tab,
            base,
            job.story,
            job.variant,
            options.style,
          );
          writeFileSync(join(dir, name), png);
          if (stable) unstable.delete(name);
          else {
            unstable.add(name);
            console.warn(`  unstable: ${name}`);
          }
        } catch (error) {
          failures.push(`${name}: ${(error as Error).message}`);
          if (!retry) retries.push(job);
          console.warn(`  failed: ${name}: ${(error as Error).message}`);
          await tab.close().catch(() => {});
          tab = await openTab(cdp);
        }
        if (!retry && ++done % 50 === 0) console.log(`  ${done} captured`);
      }
      await tab.close();
    };
    await Promise.all(
      Array.from({ length: options.jobs }, () => worker(jobs, false)),
    );
    const first = failures;
    failures = [];
    await worker(retries, true);
    for (const failure of first) {
      if (!failures.some((f) => f.split(":")[0] === failure.split(":")[0])) {
        console.log(`  retried: ${failure.split(":")[0]}`);
      }
    }
  } finally {
    cdp.close();
    kill();
    server?.close();
  }
  writeFileSync(join(dir, UNSTABLE), [...unstable].sort().join("\n"));
  console.log(`${done} captured, ${unstable.size} unstable`);
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  }
}

function runCompare(a: string, b: string) {
  const dirA = join(OUT, a);
  const dirB = join(OUT, b);
  const out = join(OUT, `compare-${a}-${b}`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const filesA = new Set(readdirSync(dirA).filter((f) => f.endsWith(".png")));
  const filesB = new Set(readdirSync(dirB).filter((f) => f.endsWith(".png")));
  const unstable = new Set([...readUnstable(dirA), ...readUnstable(dirB)]);
  const rows: string[] = [];
  const unstableRows: string[] = [];
  for (const file of [...new Set([...filesA, ...filesB])].sort()) {
    const into = unstable.has(file) ? unstableRows : rows;
    if (!filesA.has(file) || !filesB.has(file)) {
      into.push(`| ${file} | only in ${filesA.has(file) ? a : b} | |`);
      continue;
    }
    const bytesA = readFileSync(join(dirA, file));
    const bytesB = readFileSync(join(dirB, file));
    if (bytesA.equals(bytesB)) continue;
    const imgA = PNG.sync.read(bytesA);
    const imgB = PNG.sync.read(bytesB);
    if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
      into.push(
        `| ${file} | size ${imgA.width}×${imgA.height} → ${imgB.width}×${imgB.height} | |`,
      );
      continue;
    }
    const diff = new PNG({ width: imgA.width, height: imgA.height });
    const pixels = pixelmatch(
      imgA.data,
      imgB.data,
      diff.data,
      imgA.width,
      imgA.height,
      { threshold: 0, includeAA: true },
    );
    if (pixels === 0) continue;
    writeFileSync(join(out, file), PNG.sync.write(diff));
    into.push(`| ${file} | ${pixels} px | [diff](${file}) |`);
  }
  const total = new Set([...filesA, ...filesB]).size;
  const table = (list: string[]) =>
    list.length > 0
      ? ["", "| Capture | Difference | |", "|---|---|---|", ...list]
      : [];
  const report = [
    `# ${a} → ${b}`,
    "",
    `${total} captures, ${rows.length} differ.`,
    ...table(rows),
    "",
    // Never settled in one capture or the other: a difference here may be the story's own
    // motion rather than the change.
    `${unstable.size} unstable, ${unstableRows.length} of them differ.`,
    ...table(unstableRows),
    "",
  ].join("\n");
  writeFileSync(join(out, "report.md"), report);
  console.log(report);
  if (rows.length > 0) process.exitCode = 1;
}

const parsed = parseArgs(process.argv.slice(2));
if ("compare" in parsed) runCompare(...parsed.compare);
else await runCapture(parsed);
