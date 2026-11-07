import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import { buildSite } from "../scripts/build.ts";
import { MOVED } from "../src/redirect.ts";
import { routeOf } from "../src/routes.ts";

const APP = fileURLToPath(new URL("..", import.meta.url));
const routes = readdirSync(join(APP, "src/content"), {
  recursive: true,
  encoding: "utf8",
})
  .filter((file) => file.endsWith(".mdx"))
  .map((file) => routeOf(`./content/${file}`));

const filesUnder = (dir: string) =>
  readdirSync(dir, { recursive: true, encoding: "utf8" }).map((file) =>
    join(dir, file),
  );

/** Runs a page's inline redirect at `search` and returns where it went. */
function redirectOf(html: string, search: string): string | undefined {
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(([, body = ""]) => body)
    .find((body) => body.includes("storybook/"));
  expect(script, "the inline ?path= redirect").toBeDefined();
  let to: string | undefined;
  new Function("location", script ?? "")({
    search,
    hash: "",
    replace: (url: string) => {
      to = url;
    },
  });
  return to;
}

function expectEveryRoute(dist: string) {
  for (const route of routes) {
    expect(existsSync(join(dist, route, "index.html")), route).toBe(true);
  }
  expect(existsSync(join(dist, "404.html"))).toBe(true);
}

// GitHub Pages serves the site under /ui/; nothing in the app writes /ui/,
// so this build is what holds every URL to the base.
describe("a build under /ui/", () => {
  const dist = join(APP, "node_modules/.cache/docs-prefix-test/dist");
  beforeAll(() => buildSite({ base: "/ui/", outDir: dist, storybook: false }));

  it("prerenders every route", () => expectEveryRoute(dist));

  it("points every link, script and stylesheet under /ui/", () => {
    const pages = filesUnder(dist).filter((file) => file.endsWith(".html"));
    expect(pages.length).toBeGreaterThan(routes.length);
    for (const page of pages) {
      const html = readFileSync(page, "utf8");
      for (const [, url = ""] of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
        if (/^(?:[a-z]+:|#|\/\/)/.test(url)) continue;
        expect(url, `${page}: ${url}`).toMatch(/^\/ui\//);
      }
    }
  });

  it("refers to no root path outside /ui/", () => {
    // Whatever the site's root holds, written as a root path without the base.
    const escapeRegExp = (name: string) =>
      name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rootPath = (names: string[]) =>
      new RegExp(
        `[("'\`=]\\/(?:${names.map(escapeRegExp).join("|")})(?![\\w.-])`,
      );
    const roots = readdirSync(dist);
    // The bundle holds routes, base-less by design (`<Link to="/start/">`
    // adds the base, `/storybook/` included), so in JS only the paths that
    // are files count: assets/ and the like.
    const sections = new Set(routes.map((route) => route.split("/")[1]));
    const anywhere = rootPath([...roots, "storybook"]);
    const inScripts = rootPath(roots.filter((name) => !sections.has(name)));
    // Pagefind's scripts fall back to /pagefind/ only outside a browser; in
    // one they find themselves from their own URL.
    const pagefind = join(dist, "pagefind") + sep;
    for (const file of filesUnder(dist)) {
      if (!/\.(?:html|css|js)$/.test(file)) continue;
      if (file.startsWith(pagefind)) continue;
      const pattern = file.endsWith(".js") ? inScripts : anywhere;
      const match = pattern.exec(readFileSync(file, "utf8"));
      expect(match?.[0], file).toBeUndefined();
    }
  });

  it("indexes every page for search, by route", () => {
    const entry = JSON.parse(
      readFileSync(join(dist, "pagefind/pagefind-entry.json"), "utf8"),
    ) as { languages: Record<string, { page_count: number }> };
    expect(entry.languages.en?.page_count).toBe(routes.length);
    // A fragment is one page's record: gzipped JSON behind a signature.
    const fragments = join(dist, "pagefind/fragment");
    const urls = readdirSync(fragments).map((file) => {
      const text = gunzipSync(readFileSync(join(fragments, file))).toString();
      return (JSON.parse(text.slice(text.indexOf("{"))) as { url: string }).url;
    });
    // Base-less: pagefind.js adds the base it is told (search.ts).
    expect(urls.sort()).toEqual([...routes].sort());
  });

  it("sends ?path= links to /ui/storybook/", () => {
    const html = readFileSync(join(dist, "index.html"), "utf8");
    expect(redirectOf(html, "?path=/docs/ui-primitives-switch--docs")).toBe(
      "/ui/storybook/?path=/docs/ui-primitives-switch--docs",
    );
    expect(redirectOf(html, "")).toBeUndefined();
  });

  it("sends a moved route to its page, query and hash kept", () => {
    for (const [from, to] of Object.entries(MOVED)) {
      expect(routes, from).not.toContain(from);
      expect(routes, to).toContain(to);
      const html = readFileSync(join(dist, from, "index.html"), "utf8");
      const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
      let went: string | undefined;
      new Function("location", script ?? "")({
        search: "?thread=t1",
        hash: "#reply",
        replace: (url: string) => {
          went = url;
        },
      });
      expect(went).toBe(`/ui${to}?thread=t1#reply`);
    }
  });

  it("writes every page as Markdown beside its HTML", () => {
    for (const route of routes) {
      const md = readFileSync(join(dist, route, "index.md"), "utf8");
      expect(md, route).toMatch(/^# \S/);
      // The heading anchors are search-ignored, so they stay out.
      expect(md, route).not.toContain("Link to this section");
    }
  });

  it("shows a live example in its page's Markdown as the example's source", () => {
    const md = readFileSync(
      join(dist, "guidelines/principles/index.md"),
      "utf8",
    );
    const source = readFileSync(
      join(APP, "src/examples/principles/quiet-thread.tsx"),
      "utf8",
    );
    expect(md).toContain("```tsx");
    expect(md).toContain(source.trimEnd().split("\n")[0]);
  });

  it("lists in llms.txt every page the nav shows, each link a file under /ui/", () => {
    const llms = readFileSync(join(dist, "llms.txt"), "utf8");
    const links = [...llms.matchAll(/\]\(([^)]+)\)/g)].map(
      ([, url = ""]) => url,
    );
    for (const url of links) {
      expect(url, url).toMatch(/^\/ui\//);
      if (url.endsWith("/storybook/")) continue;
      expect(existsSync(join(dist, url.slice("/ui/".length))), url).toBe(true);
    }
    const shown = routes.filter((route) => {
      if (route === "/") return false;
      const file = route === "/" ? "index" : route.slice(1, -1);
      const mdx = [`${file}.mdx`, `${file}/index.mdx`]
        .map((name) => join(APP, "src/content", name))
        .find((path) => existsSync(path));
      return !readFileSync(mdx ?? "", "utf8").includes("nav: false");
    });
    for (const route of shown) {
      expect(links, route).toContain(`/ui${route}index.md`);
    }
    const full = readFileSync(join(dist, "llms-full.txt"), "utf8");
    for (const route of shown) {
      const title = readFileSync(join(dist, route, "index.md"), "utf8").split(
        "\n",
      )[0];
      expect(full, route).toContain(title);
    }
  });

  it("serves the skill from the repository's skills/", () => {
    expect(readFileSync(join(dist, "skills/orz-ui/SKILL.md"), "utf8")).toBe(
      readFileSync(join(APP, "../../skills/orz-ui/SKILL.md"), "utf8"),
    );
  });
});

// The site `pnpm build` made, when there is one: CI runs the tests after it.
const built = join(APP, "dist");
describe.skipIf(!existsSync(join(built, "index.html")))(
  "the built site",
  () => {
    it("prerenders every route", () => expectEveryRoute(built));

    it("carries Storybook under storybook/", () => {
      expect(existsSync(join(built, "storybook/index.html"))).toBe(true);
      expect(existsSync(join(built, "storybook/iframe.html"))).toBe(true);
    });

    it("sends ?path= links to /storybook/", () => {
      const html = readFileSync(join(built, "index.html"), "utf8");
      expect(redirectOf(html, "?path=/docs/a--docs")).toBe(
        "/storybook/?path=/docs/a--docs",
      );
    });
  },
);
