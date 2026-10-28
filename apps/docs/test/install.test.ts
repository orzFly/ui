import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { command, install } from "../../../scripts/install.ts";

const START = readFileSync(
  new URL("../src/content/start.mdx", import.meta.url),
  "utf8",
);

const packageOf = (specifier: string) =>
  specifier
    .split("/")
    .slice(0, specifier.startsWith("@") ? 2 : 1)
    .join("/");

describe("install", () => {
  it("installs every package Start's snippets import", () => {
    const { packages, optional } = install("@orz/ui");
    const installed = new Set([
      ...packages,
      ...optional.flatMap((group) => group.packages),
    ]);
    const blocks = [...START.matchAll(/^```tsx?\n([\s\S]*?)^```/gm)];
    expect(blocks).not.toHaveLength(0);
    const imported = blocks.flatMap(([, code = ""]) =>
      [...code.matchAll(/from "([^".][^"]*)"/g)].map(([, spec = ""]) =>
        packageOf(spec),
      ),
    );
    expect(imported.filter((name) => !installed.has(name))).toEqual([]);
  });

  it("puts an optional peer under the entry points that import it", () => {
    expect(install("@orz/ui").optional).toEqual([
      {
        packages: ["overlayscrollbars"],
        for: ["@orz/ui/hooks/use-overlay-scrollbars"],
      },
    ]);
  });

  it("breaks a line that passes the width", () => {
    expect(command(["@orz/ui", "react", "react-dom"], 26)).toBe(
      "pnpm add @orz/ui react \\\n  react-dom",
    );
  });
});
