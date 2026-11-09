import { existsSync, globSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";

// raymond is opt-in: theme.css declares its variant to draw nothing, and only
// @orz/ui/styles/raymond.css defines it. Tailwind dropping everything under a
// variant with no @slot is not documented, so this compiles the site's
// stylesheets as an app would, with and without raymond.css.

// Not `new URL(…, import.meta.url)`: see packages/ui/test/raymond.test.ts.
const ROOT = join(import.meta.dirname, "../../..");
const SITE_CSS = join(ROOT, "apps/docs/src/styles.css");
const RAYMOND = '@import "@orz/ui/styles/raymond.css";';
const MARKER = 'data-style="raymond"';

/** A bare stylesheet id, resolved as Tailwind's own loader would: the package's `style` export. */
function resolveBare(id: string, from: string): string {
  const parts = id.split("/");
  const name = id.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  const subpath = id.slice(name.length);
  for (let dir = from; ; dir = dirname(dir)) {
    const pkg = join(dir, "node_modules", name);
    if (existsSync(pkg)) {
      if (subpath) return join(pkg, subpath);
      const manifest = JSON.parse(
        readFileSync(join(pkg, "package.json"), "utf8"),
      );
      return join(pkg, manifest.exports?.["."]?.style ?? manifest.style);
    }
    if (dir === dirname(dir)) throw new Error(`cannot resolve ${id}`);
  }
}

async function loadStylesheet(id: string, base: string) {
  const path = id.startsWith(".") ? resolve(base, id) : resolveBare(id, base);
  return { path, base: dirname(path), content: readFileSync(path, "utf8") };
}

/** The site's stylesheet imports, with raymond.css left out or moved. */
function siteImports(raymond: "none" | "after-ui" | "last"): string {
  const imports = readFileSync(SITE_CSS, "utf8")
    .split("\n")
    .filter((line) => line.startsWith("@import "));
  const rest = imports.filter((line) => line !== RAYMOND);
  expect(rest.length, "the site imports raymond.css").toBe(imports.length - 1);
  if (raymond === "none") return rest.join("\n");
  if (raymond === "last") return [...rest, RAYMOND].join("\n");
  const ui = rest.indexOf('@import "@orz/ui/styles.css";');
  return [...rest.slice(0, ui + 1), RAYMOND, ...rest.slice(ui + 1)].join("\n");
}

const RAYMOND_CLASSES = [
  ...new Set(
    globSync("packages/*/src/**/*.{ts,tsx}", { cwd: ROOT }).flatMap((file) =>
      [
        ...readFileSync(join(ROOT, file), "utf8").matchAll(
          /(?<![\w-])raymond:(?:[^\s"'`[]|\[[^\]\s]*\])+/g,
        ),
      ].map(([name]) => name),
    ),
  ),
];
const PLAIN_CLASSES = ["bg-muted", "flex"];

async function build(raymond: "none" | "after-ui" | "last") {
  const compiler = await compile(siteImports(raymond), {
    base: dirname(SITE_CSS),
    loadStylesheet,
  });
  return compiler.build([...RAYMOND_CLASSES, ...PLAIN_CLASSES]);
}

/** A class name as a selector, as Tailwind escapes it. */
const selectorOf = (name: string) =>
  `.${name.replace(/[^\w-]/g, (c) => `\\${c}`)}`;

describe("raymond opt-in", () => {
  it("finds the raymond: classes it compiles", () => {
    expect(RAYMOND_CLASSES.length).toBeGreaterThan(50);
  });

  it("carries no raymond CSS when raymond.css is not imported", async () => {
    const css = await build("none");
    expect(css).not.toContain(MARKER);
    for (const name of PLAIN_CLASSES) expect(css).toContain(selectorOf(name));
    console.log(`without raymond.css: ${css.length} bytes`);
  });

  it("draws every raymond part when it is", async () => {
    const css = await build("after-ui");
    for (const name of RAYMOND_CLASSES) {
      expect(css, name).toContain(selectorOf(name));
    }
    expect(css).toContain(`.orz-hex:is([${MARKER}] *)`);
    expect(css).toContain(`diffs-container:is([${MARKER}] *)`);
    console.log(`with raymond.css: ${css.length} bytes`);
  });

  it("draws the same wherever raymond.css follows @orz/ui/styles.css", async () => {
    // Its own tokens move with it in the output, so the rules match, not their order.
    const lines = (css: string) => css.split("\n").sort();
    expect(lines(await build("last"))).toEqual(lines(await build("after-ui")));
  });

  it("puts the variant before a pseudo-element, and never on :scope", async () => {
    const css = await build("after-ui");
    expect(css).not.toContain("::before:is(");
    expect(css).not.toContain("::after:is(");
    expect(css).not.toContain(":scope:is(");
  });

  it("keys raymond rules only through the variant", () => {
    const own = "packages/ui/styles/raymond.css";
    const sheets = globSync("packages/*/**/*.css", {
      cwd: ROOT,
      exclude: (path) => /(^|\/)(node_modules|dist)$/.test(path),
    }).filter((file) => relative(own, file) !== "");
    expect(sheets).toContain("packages/ui-hex/styles.css");
    for (const file of sheets) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text, file).not.toContain(`[${MARKER}]`);
      expect(text, file).not.toContain("@apply raymond:");
    }
  });
});
