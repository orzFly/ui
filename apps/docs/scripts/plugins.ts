import { createReadStream, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, ViteDevServer } from "vite";
import { fillTemplate } from "./html.ts";

const APP = fileURLToPath(new URL("..", import.meta.url));
const EXAMPLES = join(APP, "src/examples/");
const REGISTRY = join(APP, "src/example-source.ts");
const STORYBOOK = join(APP, "../storybook/storybook-static");

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
      )) as typeof import("../src/entry-server.tsx");
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

export function docsPlugins(): Plugin[] {
  return [
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
        return () => serveRendered(server);
      },
    },
  ];
}
