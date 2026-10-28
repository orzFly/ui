import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  demoFileNames,
  fixtureImports,
  loadDemoFiles,
} from "../src/demos/demo-source.ts";

const pages = readdirSync(join(import.meta.dirname, "../src/content/demos"))
  .filter((file) => file.endsWith(".mdx") && file !== "index.mdx")
  .map((file) => file.replace(/\.mdx$/, ""));

describe("demo source", () => {
  it.each(pages)("finds %s's files, its own component first", (page) => {
    expect(demoFileNames(page)[0]).toBe(`${page}.tsx`);
  });

  it("lists a demo's files, then the fixtures they import", async () => {
    const files = await loadDemoFiles("inbox");
    expect(files.map(({ name, group }) => `${group} ${name}`)).toEqual([
      "demo inbox.tsx",
      "demo compose.tsx",
      "demo keys.tsx",
      "demo location.ts",
      "demo mailbox.ts",
      "demo sidebar.tsx",
      "demo thread.tsx",
      "fixtures @orz/fixtures/inbox.ts",
    ]);
    expect(files[0]?.contents).toContain("export function Inbox");
  });

  it("reads fixture imports across lines and past a query", () => {
    expect(
      fixtureImports([
        'import {\n  a,\n} from "@orz/fixtures/inbox.ts";',
        'import text from "@orz/fixtures/patch/series.patch?raw";',
        'import { b } from "@orz/fixtures/inbox.ts";',
      ]),
    ).toEqual(["inbox.ts", "patch/series.patch"]);
  });

  it("leaves out a fixture that is not text", () => {
    expect(
      fixtureImports([
        'import url from "@orz/fixtures/attachment/tone.ogg?url";',
      ]),
    ).toEqual([]);
  });
});
