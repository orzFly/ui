// Sentences that name what the code knows, where the reason around the names is the point and
// the names stay prose: each is held to the code here rather than generated.
import { readFileSync } from "node:fs";
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
  it("draws CardTitle, DialogTitle and SheetTitle as the scale's title", () => {
    for (const [file, slot] of [
      ["card.tsx", "card-title"],
      ["dialog.tsx", "dialog-title"],
      ["sheet.tsx", "sheet-title"],
    ]) {
      expect(classOf(file, `slot:${slot}`).split(" "), slot).toEqual(
        expect.arrayContaining(["font-heading", "text-base", "font-medium"]),
      );
    }
    expect(
      read("apps/docs/src/content/guidelines/foundations/typography.mdx"),
    ).toContain(
      "`CardTitle`,\n`DialogTitle` and `SheetTitle` are `font-heading text-base font-medium`, a `Badge` is `text-xs`.",
    );
  });

  it("sets a Badge in text-xs", () => {
    expect(classOf("badge.tsx", "group/badge").split(" ")).toContain("text-xs");
  });
});
