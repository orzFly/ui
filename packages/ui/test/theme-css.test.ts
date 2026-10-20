import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEMES } from "../src/theme/index.ts";

// Not `new URL(…, import.meta.url)`: under happy-dom `URL` is the window's
// class, which node:fs refuses as a file URL.
const STYLES = readFileSync(join(import.meta.dirname, "../styles.css"), "utf8");

function tokensOf(selector: string): Record<string, string> | null {
  const head = `${selector} {`;
  const start = STYLES.indexOf(head);
  if (start < 0) return null;
  const body = STYLES.slice(start + head.length, STYLES.indexOf("\n}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g))
    out[m[1]] = m[2].trim();
  return out;
}

const themeBlock = (value: string) => tokensOf(`:root[data-theme="${value}"]`);

describe("styles.css theme blocks", () => {
  it("has a token block for every theme, so a new one cannot go unstyled", () => {
    const unstyled = THEMES.filter(
      (t) =>
        themeBlock(t.value) === null &&
        t.value !== "light" &&
        t.value !== "dark",
    );
    expect(unstyled.map((t) => t.value)).toEqual([]);
    // The two themes with no data-theme block of their own are the defaults,
    // and they only render because these blocks carry the full palette.
    expect(tokensOf(":root")).toHaveProperty("--card");
    expect(tokensOf(".dark")).toHaveProperty("--card");
  });

  it("has exactly one block per theme and none for a theme THEMES lacks", () => {
    const blocks = [...STYLES.matchAll(/:root\[data-theme="([^"]+)"\]/g)].map(
      (m) => m[1],
    );
    const named = THEMES.map((t) => t.value as string).filter(
      (v) => v !== "light" && v !== "dark",
    );
    expect([...blocks].sort()).toEqual([...named].sort());
  });

  it("gives every block the same tokens as the defaults", () => {
    const expected = Object.keys(tokensOf(":root") ?? {})
      .filter((t) => t !== "--radius")
      .sort();
    const drift = THEMES.filter(
      (t) => t.value !== "light" && t.value !== "dark",
    )
      .map((t) => ({
        theme: t.value,
        keys: Object.keys(themeBlock(t.value) ?? {}).sort(),
      }))
      .filter(({ keys }) => keys.join() !== expected.join())
      .map(({ theme }) => theme);
    expect(drift).toEqual([]);
  });
});
