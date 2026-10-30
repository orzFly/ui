import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Manifest } from "vite";
import { MOVED, movedPage } from "../src/redirect.ts";
import { hrefOf } from "../src/routes.ts";
import { fillTemplate } from "./html.ts";
import { closeSearch, type IndexedPage, searchIndex } from "./search.ts";

const APP = fileURLToPath(new URL("..", import.meta.url));
const STORYBOOK = resolve(APP, "../storybook/storybook-static");

export interface BuildOptions {
  /** Where the site is served from: "/" everywhere but GitHub Pages, which takes "/ui/". */
  base: string;
  outDir: string;
  /** Copy Storybook's build into storybook/. A deploy needs it; a test of the docs app alone skips it. */
  storybook: boolean;
}

/** A chunk and the chunks it imports statically: what the page needs before it can hydrate. */
function chunksOf(manifest: Manifest, key: string, into = new Set<string>()) {
  const chunk = manifest[key];
  if (!chunk || into.has(chunk.file)) return into;
  into.add(chunk.file);
  for (const imported of chunk.imports ?? []) {
    chunksOf(manifest, imported, into);
  }
  return into;
}

/**
 * The client build, then a server build of entry-server.tsx that renders
 * every route into `<route>/index.html` and a 404.html, then the search
 * index of those pages into pagefind/, then Storybook.
 */
export async function buildSite({ base, outDir, storybook }: BuildOptions) {
  const out = resolve(APP, outDir);
  if (storybook && !existsSync(join(STORYBOOK, "index.html"))) {
    throw new Error(
      `${STORYBOOK} has no build: pnpm -r build builds @orz/storybook first`,
    );
  }
  await build({
    root: APP,
    base,
    logLevel: "warn",
    build: { outDir: out, emptyOutDir: true, manifest: true },
  });
  // Inside the app, so the bundle's externals resolve from its node_modules.
  const ssrDir = join(
    APP,
    "node_modules/.cache/docs-ssr",
    encodeURIComponent(base),
  );
  await build({
    root: APP,
    base,
    logLevel: "warn",
    // Bundled whole: the packages' own dependencies are not the app's, so
    // Node could not resolve them from the bundle.
    ssr: { noExternal: true },
    build: {
      ssr: "src/entry-server.tsx",
      outDir: ssrDir,
      emptyOutDir: true,
    },
  });
  // Imported once per directory: a second copy of the entry would hold a
  // second set of module state from the chunks that import it.
  const entry = (await import(
    pathToFileURL(join(ssrDir, "entry-server.js")).href
  )) as typeof import("../src/entry-server.tsx");

  const manifestFile = join(out, ".vite/manifest.json");
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8")) as Manifest;
  const shared = chunksOf(manifest, "index.html");
  const template = readFileSync(join(out, "index.html"), "utf8");
  const indexed: IndexedPage[] = [];
  for (const { route, file } of entry.routes()) {
    const page = await entry.render(base + route.slice(1));
    // The page's chunk is fetched with the entry rather than after it, since
    // hydration waits for both.
    const preload = [...chunksOf(manifest, file)]
      .filter((chunk) => !shared.has(chunk))
      .map(
        (chunk) =>
          `<link rel="modulepreload" crossorigin href="${base}${chunk}">`,
      );
    const html = fillTemplate(template, {
      ...page,
      head: [page.head, ...preload].join("\n    "),
    });
    const dir = join(out, route);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
    indexed.push({ route, html });
  }
  for (const [from, to] of Object.entries(MOVED)) {
    const dir = join(out, from);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), movedPage(hrefOf(to, base)));
  }
  // GitHub Pages answers every unknown path with the root's 404.html.
  const missing = await entry.render(`${base}404/`);
  writeFileSync(join(out, "404.html"), fillTemplate(template, missing));
  rmSync(join(out, ".vite"), { recursive: true });
  rmSync(ssrDir, { recursive: true, force: true });

  // Before Storybook lands in out/, so its pages are not indexed.
  const index = await searchIndex(indexed);
  await index.writeFiles({ outputPath: join(out, "pagefind") });
  await closeSearch();

  if (storybook) {
    cpSync(STORYBOOK, join(out, "storybook"), { recursive: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await buildSite({
    base: process.env.DOCS_BASE ?? "/",
    outDir: "dist",
    storybook: true,
  });
}
