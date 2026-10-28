import { readdirSync, readFileSync } from "node:fs";
import { loadCsf } from "storybook/internal/csf-tools";
import { describe, expect, it } from "vitest";
import { exampleExport, metaFrom } from "../scripts/plugins.ts";
import type { PageMeta } from "../src/page.ts";
import { buildNav, type NavNode, routeOf } from "../src/routes.ts";

const SRC = new URL("../src/", import.meta.url);
const CONTENT = new URL("content/", SRC);
const EXAMPLES = new URL("examples/", SRC);
const STORIES = new URL("../../storybook/src/", import.meta.url);

const filesIn = (dir: URL, extension: string) =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(extension))
    .sort();

// What the orz-docs:meta plugin hands the nav, evaluated the way the bundle does.
const pages = filesIn(CONTENT, ".mdx").map((file) => {
  const source = readFileSync(new URL(file, CONTENT), "utf8");
  const code = metaFrom(source, file).replace(
    /^export const meta = /,
    "return ",
  );
  return {
    file,
    route: routeOf(`./content/${file}`),
    meta: new Function(code)() as PageMeta,
  };
});

// Storybook's own parser, as apps/storybook/test/stories.test.ts reads them.
const stories = filesIn(STORIES, ".stories.tsx").map((file) => {
  const text = readFileSync(new URL(file, STORIES), "utf8");
  const csf = loadCsf(text, { fileName: file, makeTitle: (title) => title });
  return { file, text, title: csf.parse().meta?.title ?? "" };
});

const routes = new Set(pages.map((page) => page.route));

describe("content", () => {
  it.each(pages)("$file has meta.title", ({ meta }) => {
    expect(typeof meta.title).toBe("string");
    expect(meta.title.trim()).not.toBe("");
  });

  it("gives every page a route of its own", () => {
    expect(routes.size).toBe(pages.length);
  });

  it("lists in the nav exactly the routes that have a page and want to be", () => {
    const listed: string[] = [];
    const walk = (node: NavNode) => {
      if (node.page) listed.push(node.route);
      // A heading with nothing under it is a nav entry with no page.
      if (!node.page) expect(node.children, node.route).not.toHaveLength(0);
      for (const child of node.children) walk(child);
    };
    walk(buildNav(pages));
    const wanted = pages
      .filter((page) => page.meta.nav !== false)
      .map((page) => page.route);
    expect(listed.sort()).toEqual(wanted.sort());
  });

  it("links API titles to stories that exist", () => {
    const titles = new Set(stories.map((story) => story.title));
    for (const { file, meta } of pages) {
      for (const title of meta.api ?? []) {
        expect(titles.has(title), `${file}: ${title}`).toBe(true);
      }
    }
  });
});

describe("demos", () => {
  const demos = pages.filter(
    ({ route }) => route.startsWith("/demos/") && route !== "/demos/",
  );
  const guidelines = pages.filter(
    ({ route }) => route.startsWith("/guidelines/") && route !== "/guidelines/",
  );

  it.each(demos)(
    "$file names the guidelines it puts into practice",
    ({ meta }) => {
      expect(meta.guidelines ?? []).not.toHaveLength(0);
    },
  );

  it("name guideline pages that exist, once each, with where to look", () => {
    for (const { file, meta } of demos) {
      const named = (meta.guidelines ?? []).map(({ route }) => route);
      expect(new Set(named).size, file).toBe(named.length);
      for (const { route, where } of meta.guidelines ?? []) {
        expect(
          guidelines.some((page) => page.route === route),
          `${file}: ${route}`,
        ).toBe(true);
        expect(where, `${file}: ${route}`).toMatch(/^\S.*\.$/s);
      }
    }
  });

  it.each(guidelines)("$file is put into practice by a demo", ({ route }) => {
    expect(
      demos.some(({ meta }) =>
        meta.guidelines?.some((guideline) => guideline.route === route),
      ),
    ).toBe(true);
  });
});

describe("stories", () => {
  const GUIDELINES = /\bguidelines:\s*["'`]([^"'`]+)["'`]/g;

  it("link back to guideline pages that exist", () => {
    for (const { file, text } of stories) {
      for (const [, path = ""] of text.matchAll(GUIDELINES)) {
        expect(routes.has(path), `${file}: ${path}`).toBe(true);
      }
    }
  });

  it("are listed in the API of the guideline page they link back to", () => {
    for (const { file, text, title } of stories) {
      for (const [, path = ""] of text.matchAll(GUIDELINES)) {
        const page = pages.find((p) => p.route === path);
        expect(page?.meta.api ?? [], `${file}: ${path}`).toContain(title);
      }
    }
  });
});

describe("examples", () => {
  it.each(filesIn(EXAMPLES, ".tsx"))(
    "%s exports one component, the one its source is shown for",
    (file) => {
      const source = readFileSync(new URL(file, EXAMPLES), "utf8");
      expect(() => exampleExport(source, file)).not.toThrow();
    },
  );
});
