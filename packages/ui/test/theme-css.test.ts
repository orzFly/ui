import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  defaultTheme,
  type Palette,
  TERMINAL_TOKEN_NAMES,
  TOKEN_NAMES,
} from "@orz/themes";
import { describe, expect, it } from "vitest";

// Not `new URL(…, import.meta.url)`: under happy-dom `URL` is the window's
// class, which node:fs refuses as a file URL.
const STYLES = readFileSync(join(import.meta.dirname, "../styles.css"), "utf8");

function tokensOf(selector: string): Record<string, string> {
  const head = `\n${selector} {`;
  const start = STYLES.indexOf(head);
  if (start < 0) return {};
  const body = STYLES.slice(start + head.length, STYLES.indexOf("\n}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g))
    out[m[1]] = m[2].trim();
  return out;
}

function expected(
  palette: Palette | undefined,
): Record<string, string | undefined> {
  return {
    ...Object.fromEntries(TOKEN_NAMES.map((n) => [n, palette?.tokens[n]])),
    ...Object.fromEntries(
      TERMINAL_TOKEN_NAMES.map((n) => [n, palette?.terminal[n]]),
    ),
  };
}

describe("styles.css baseline", () => {
  // The baseline is what a primitive paints with outside any store, so it
  // must be the default theme exactly, or the first paint and the store's
  // disagree.
  it("is the default theme's light palette in :root, terminal tokens included", () => {
    const { radius, ...root } = tokensOf(":root");
    expect(radius).toBeDefined();
    expect(root).toEqual(expected(defaultTheme.light));
  });

  it("is the default theme's dark palette in .dark", () => {
    expect(tokensOf(".dark")).toEqual(expected(defaultTheme.dark));
  });

  it("has no per-theme blocks left; themes paint from data", () => {
    expect(STYLES).not.toContain("[data-theme");
  });

  it("maps every terminal token to a Tailwind colour", () => {
    for (const name of TERMINAL_TOKEN_NAMES) {
      expect(STYLES).toContain(`--color-${name}: var(--${name});`);
    }
  });
});
