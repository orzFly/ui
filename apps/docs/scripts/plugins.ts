import { createReadStream, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, ViteDevServer } from "vite";
import { installs, installText, workspaces } from "../../../scripts/install.ts";
import { themeTable } from "../../../scripts/themes.ts";
import {
  cssLengths,
  DEMOS,
  demoApis,
  internalClasses,
  packageSummaries,
  STORIES,
} from "./data.ts";
import { fillTemplate } from "./html.ts";
import { closeSearch, searchIndex } from "./search.ts";

const APP = fileURLToPath(new URL("..", import.meta.url));
const EXAMPLES = join(APP, "src/examples/");
const REGISTRY = join(APP, "src/example-source.ts");
const STORYBOOK = join(APP, "../storybook/storybook-static");
const THEMES = join(APP, "../../packages/themes/src");
const UI = join(APP, "../../packages/ui");

const META_QUERY = "?meta";
const META = /^export const meta = /m;
const EXPORT = /^export (?:default )?function ([A-Z]\w*)/gm;

/**
 * `page.mdx?meta`: the page's `meta` export on its own. The nav needs every
 * page's meta up front; importing the pages themselves for it would pull
 * every page and every example it imports into the first chunk.
 */
export function metaFrom(source: string, file: string): string {
  const start = source.search(META);
  if (start < 0) throw new Error(`${file}: no \`export const meta = …\``);
  // MDX ends an export block at the first blank line.
  const end = source.indexOf("\n\n", start);
  return source.slice(start, end < 0 ? undefined : end);
}

/** The one component an example file exports; the site shows the file as its source. */
export function exampleExport(source: string, file: string): string {
  const names = [...source.matchAll(EXPORT)].map(([, name]) => name);
  const [name] = names;
  if (names.length !== 1 || name === undefined) {
    throw new Error(
      `${file}: an example exports exactly one component (export function Name), found ${names.length}`,
    );
  }
  return name;
}

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".pagefind": "application/octet-stream",
  ".pf_meta": "application/octet-stream",
  ".pf_index": "application/octet-stream",
  ".pf_fragment": "application/octet-stream",
};

/** Serves a built storybook-static under the base's storybook/, so its links work in dev. */
function serveStorybook(server: ViteDevServer) {
  const prefix = `${server.config.base}storybook/`;
  server.middlewares.use((req, res, next) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0] ?? "");
    if (!path.startsWith(prefix)) return next();
    let file = resolve(STORYBOOK, `./${path.slice(prefix.length)}`);
    if (!file.startsWith(STORYBOOK)) return next();
    try {
      if (statSync(file).isDirectory()) file = join(file, "index.html");
      statSync(file);
    } catch {
      res.statusCode = 404;
      res.end(
        "No Storybook build: run `pnpm --filter @orz/storybook build`, or `pnpm --filter @orz/storybook dev` for its own server.",
      );
      return;
    }
    res.setHeader(
      "content-type",
      TYPES[extname(file)] ?? "application/octet-stream",
    );
    createReadStream(file).pipe(res);
  });
}

type DevEntry = typeof import("../src/entry-server.tsx");

/**
 * The search index in dev, built in memory from the pages as rendered now,
 * the first time a search asks for it after an edit.
 */
function serveSearch(server: ViteDevServer) {
  const prefix = `${server.config.base}pagefind/`;
  let files: Promise<Map<string, Uint8Array>> | undefined;
  const build = async () => {
    const template = readFileSync(join(APP, "index.html"), "utf8");
    const entry = (await server.ssrLoadModule(
      "/src/entry-server.tsx",
    )) as DevEntry;
    const pages = [];
    for (const { route } of entry.routes()) {
      const page = await entry.render(server.config.base + route.slice(1));
      pages.push({ route, html: fillTemplate(template, page) });
    }
    const index = await searchIndex(pages);
    const { files: written, errors } = await index.getFiles();
    if (errors.length > 0) throw new Error(`pagefind: ${errors.join("; ")}`);
    return new Map(written.map((file) => [file.path, file.content]));
  };
  server.watcher.on("all", () => {
    files = undefined;
  });
  server.httpServer?.on("close", () => void closeSearch());
  server.middlewares.use(async (req, res, next) => {
    const path = (req.url ?? "").split("?")[0] ?? "";
    if (!path.startsWith(prefix)) return next();
    try {
      files ??= build();
      const content = (await files).get(path.slice(prefix.length));
      if (!content) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader(
        "content-type",
        TYPES[extname(path)] ?? "application/octet-stream",
      );
      res.end(content);
    } catch (error) {
      files = undefined;
      next(error);
    }
  });
}

/** Renders each page on the server in dev too, so hydration is exercised before a build. */
function serveRendered(server: ViteDevServer) {
  server.middlewares.use(async (req, res, next) => {
    if (req.method !== "GET" || !req.headers.accept?.includes("text/html")) {
      return next();
    }
    try {
      const url = req.originalUrl ?? "/";
      const template = await server.transformIndexHtml(
        url,
        readFileSync(join(APP, "index.html"), "utf8"),
      );
      const entry = (await server.ssrLoadModule(
        "/src/entry-server.tsx",
      )) as DevEntry;
      const page = await entry.render(new URL(url, "http://dev").pathname);
      res.statusCode = page.status;
      res.setHeader("content-type", "text/html");
      res.end(fillTemplate(template, page));
    } catch (error) {
      if (error instanceof Error) server.ssrFixStacktrace(error);
      next(error);
    }
  });
}

// Files only: Vite dev resolves every watched path as an import of the virtual module, and a
// directory does not resolve.
const filesUnder = (dir: string) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));

/**
 * What the pages restate from the code, as virtual modules worked out from it (data.ts):
 * `virtual:orz-install` every package's install lines, as the READMEs have them;
 * `virtual:orz-packages` each package's description; `virtual:orz-themes` the built-in
 * themes' table; `virtual:orz-demo-api` the Storybook pages each demo uses; and
 * `virtual:orz-ui-source` the class strings of `@orz/ui`'s internal parts and the lengths
 * its stylesheets set.
 */
export function dataPlugin(): Plugin {
  const modules: Record<string, () => { data: unknown; watch: string[] }> = {
    "virtual:orz-install": () => {
      const all = workspaces();
      return {
        data: installs(all).map(installText),
        watch: [...all.values()].map(({ dir }) => join(dir, "package.json")),
      };
    },
    "virtual:orz-packages": () => ({
      data: packageSummaries(),
      watch: [...workspaces().values()].map(({ dir }) =>
        join(dir, "package.json"),
      ),
    }),
    "virtual:orz-themes": () => ({
      data: themeTable(),
      watch: filesUnder(THEMES),
    }),
    "virtual:orz-demo-api": () => ({
      data: demoApis(),
      watch: [...filesUnder(DEMOS), ...filesUnder(STORIES)],
    }),
    "virtual:orz-ui-source": () => ({
      data: { classes: internalClasses(), css: cssLengths() },
      watch: [
        ...filesUnder(join(UI, "src/components")),
        join(UI, "styles.css"),
        join(UI, "theme.css"),
      ],
    }),
  };
  return {
    name: "orz-docs:data",
    resolveId: (id) => (id in modules ? `\0${id}` : undefined),
    load(id) {
      const make = modules[id.slice(1)];
      if (!id.startsWith("\0") || !make) return;
      const { data, watch } = make();
      for (const file of watch) this.addWatchFile(file);
      return `export default ${JSON.stringify(data)};`;
    },
  };
}

export function docsPlugins(): Plugin[] {
  return [
    dataPlugin(),
    {
      name: "orz-docs:meta",
      enforce: "pre",
      load(id) {
        if (!id.endsWith(`.mdx${META_QUERY}`)) return;
        const file = id.slice(0, -META_QUERY.length);
        this.addWatchFile(file);
        return metaFrom(readFileSync(file, "utf8"), file);
      },
    },
    {
      name: "orz-docs:example-source",
      enforce: "pre",
      transform(code, id) {
        if (!id.startsWith(EXAMPLES) || !id.endsWith(".tsx")) return;
        const name = exampleExport(code, id);
        return `${code}
import { registerExampleSource as __registerExampleSource } from ${JSON.stringify(REGISTRY)};
import __exampleSource from ${JSON.stringify(`${id}?raw`)};
__registerExampleSource(${name}, __exampleSource);
`;
      },
    },
    {
      name: "orz-docs:dev",
      apply: (_config, { command, isPreview }) =>
        command === "serve" && !isPreview,
      // The pages are rendered by serveRendered, not served as index.html.
      config: () => ({ appType: "custom" }),
      configureServer(server) {
        serveStorybook(server);
        serveSearch(server);
        return () => serveRendered(server);
      },
    },
  ];
}
