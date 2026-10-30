// Sentences that name what the code knows, where the reason around the names is the point and
// the names stay prose: each is held to the code here rather than generated.
import { readFileSync } from "node:fs";
import {
  builtinThemes,
  defaultStyle,
  raymondStyle,
  themesForStyle,
} from "@orz/themes";
import { createThemeStore, useStyle } from "@orz/ui/theme";
import { describe, expect, it } from "vitest";
import { workspaces } from "../../../scripts/install.ts";
import { classOf } from "../scripts/data.ts";

const read = (path: string) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

/** The backticked names, and React, in the one sentence of `text` that matches `pattern`. */
function named(text: string, pattern: RegExp): string[] {
  const sentences = text
    .split(/\n\s*\n/)
    .flatMap((paragraph) => paragraph.replace(/\n/g, " ").split(/(?<=\.)\s/))
    .filter((sentence) => pattern.test(sentence));
  expect(sentences, String(pattern)).toHaveLength(1);
  const sentence = (sentences[0] ?? "").split(pattern)[0] ?? "";
  return [
    ...[...sentence.matchAll(/`([^`]+)`/g)].map(([, name = ""]) => name),
    ...(/\bReact\b/.test(sentence) ? ["React"] : []),
  ].sort();
}

const ui = workspaces().get("@orz/ui")?.manifest;
const peers = Object.keys(ui?.peerDependencies ?? {})
  .filter((peer) => !ui?.peerDependenciesMeta?.[peer]?.optional)
  .map((peer) => (peer === "react" || peer === "react-dom" ? "React" : peer));
const orzDependencies = Object.keys(ui?.dependencies ?? {}).filter((name) =>
  name.startsWith("@orz/"),
);

describe.each([
  ["packages/ui/README.md", / are dependencies of /],
  ["apps/docs/src/content/start.mdx", / are `@orz\/ui`'s own dependencies/],
])("%s", (path, dependencies) => {
  const text = read(path);

  it("names @orz/ui's required peers", () => {
    expect(named(text, / are peer dependencies/)).toEqual(
      [...new Set(peers)].sort(),
    );
  });

  it("names @orz/ui's @orz/ dependencies", () => {
    expect(named(text, dependencies)).toEqual(orzDependencies.sort());
  });
});

describe("typography", () => {
  it("draws DialogTitle and SheetTitle as the scale's title, CardTitle as a module's name", () => {
    for (const [file, slot] of [
      ["dialog.tsx", "dialog-title"],
      ["sheet.tsx", "sheet-title"],
    ]) {
      expect(classOf(file, `slot:${slot}`).split(" "), slot).toEqual(
        expect.arrayContaining(["font-heading", "text-title", "font-medium"]),
      );
    }
    expect(classOf("card.tsx", "slot:card-title").split(" ")).toEqual(
      expect.arrayContaining(["font-heading", "text-ui-sm", "font-bold"]),
    );
    expect(
      read(
        "apps/docs/src/content/guidelines/foundations/typography.mdx",
      ).replace(/\s+/g, " "),
    ).toContain(
      "`DialogTitle` and `SheetTitle` are `font-heading text-title font-medium`, a `CardTitle` is a module's name in its ruled header, `font-heading text-ui-sm font-bold`, and a `Badge` is `text-ui-xs`.",
    );
  });

  it("sets a Badge in text-ui-xs", () => {
    expect(classOf("badge.tsx", "group/badge").split(" ")).toContain(
      "text-ui-xs",
    );
  });
});

describe("theming", () => {
  const text = read("apps/docs/src/content/guidelines/foundations/theming.mdx");
  const themes = builtinThemes;

  it("names the style options as createThemeStore takes them", () => {
    expect(named(text, / style alone, and the menu has no Style row/)).toEqual([
      "createThemeStore({ styles, defaultStyle })",
      "defaultStyle",
      "styles",
    ]);
    const bevel = { id: "bevel", label: "Bevel" };
    const offered = createThemeStore({
      storageKey: "facts",
      themes,
      styles: [defaultStyle, bevel],
      defaultStyle: "bevel",
    });
    expect(offered.getStyle()).toBe("bevel");
    expect(
      createThemeStore({ storageKey: "facts", themes }).getStyles(),
    ).toEqual([defaultStyle]);
  });

  it("names how to offer raymond", () => {
    expect(named(text, / whose built-in themes\s+include its own/)).toEqual([
      "@orz/themes",
      "@orz/ui",
      "@orz/ui/styles.css",
      "@orz/ui/styles/raymond.css",
      "raymondStyle",
    ]);
    expect(raymondStyle.id).toBe("raymond");
    expect(themesForStyle(builtinThemes, raymondStyle.id)).not.toEqual([]);
    expect(
      Object.keys(workspaces().get("@orz/ui")?.manifest.exports ?? {}),
    ).toContain("./styles/*.css");
    expect(
      readFileSync(
        new URL("../../../packages/ui/styles/raymond.css", import.meta.url),
      ),
    ).toBeTruthy();
  });

  it("names the calls that switch the style", () => {
    expect(named(text, / switches it\./)).toEqual([
      "ThemeMenu",
      "setStyle",
      "useStyle()",
    ]);
    expect(
      createThemeStore({ storageKey: "facts", themes }).setStyle,
    ).toBeTypeOf("function");
    expect(useStyle).toBeTypeOf("function");
  });
});
