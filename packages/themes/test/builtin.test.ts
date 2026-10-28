import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  builtinThemes,
  type ColorScheme,
  resolvePalette,
  schemesOf,
  TERMINAL_TOKEN_NAMES,
  type Theme,
  TOKEN_NAMES,
  variantsOf,
} from "../src/index.ts";
import { rgbOf } from "../src/rgb.ts";

const palettes = builtinThemes.flatMap((theme) =>
  schemesOf(theme).map((scheme) => ({
    theme,
    scheme,
    // biome-ignore lint/style/noNonNullAssertion: schemesOf lists only present sides
    palette: theme[scheme]!,
  })),
);

const OKLCH = /^oklch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+\s*(\/\s*[\d.]+%?\s*)?\)$/;
const HEX = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/;

describe("builtinThemes", () => {
  it("has unique ids, and a palette on every theme", () => {
    const ids = builtinThemes.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const theme of builtinThemes) {
      expect(schemesOf(theme).length).toBeGreaterThan(0);
    }
  });

  it("sets every UI token to an oklch() or hex value, and nothing else", () => {
    for (const { theme, scheme, palette } of palettes) {
      const where = `${theme.id} ${scheme}`;
      expect(Object.keys(palette.tokens).sort(), where).toEqual(
        [...TOKEN_NAMES].sort(),
      );
      for (const name of TOKEN_NAMES) {
        const value = palette.tokens[name];
        expect(OKLCH.test(value) || HEX.test(value), `${where} ${name}`).toBe(
          true,
        );
      }
    }
  });

  it("sets every terminal token to lowercase #rrggbb or #rrggbbaa", () => {
    for (const { theme, scheme, palette } of palettes) {
      const where = `${theme.id} ${scheme}`;
      expect(Object.keys(palette.terminal).sort(), where).toEqual(
        [...TERMINAL_TOKEN_NAMES].sort(),
      );
      for (const name of TERMINAL_TOKEN_NAMES) {
        expect(palette.terminal[name], `${where} ${name}`).toMatch(HEX);
      }
    }
  });

  it("puts the terminal on the page's own background and foreground", () => {
    for (const { theme, scheme, palette } of palettes) {
      for (const [terminal, ui] of [
        ["terminal-background", "background"],
        ["terminal-foreground", "foreground"],
      ] as const) {
        const want = rgbOf(palette.tokens[ui]);
        const got = rgbOf(palette.terminal[terminal]);
        // Within one step of hex rounding per channel.
        const off = Math.max(...want.map((v, i) => Math.abs(v - got[i])));
        expect(off, `${theme.id} ${scheme} ${terminal}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("gives every dark palette an AMOLED variant whose terminal is black", () => {
    for (const { theme, scheme } of palettes) {
      if (scheme !== "dark") continue;
      const resolved = resolvePalette(theme, "dark", "amoled");
      expect(resolved?.variant, theme.id).toBe("amoled");
      expect(resolved?.tokens.background).toBe("oklch(0 0 0)");
      expect(resolved?.terminal["terminal-background"]).toBe("#000000");
    }
  });

  it("survives a JSON round trip, so a theme is plain data", () => {
    for (const theme of builtinThemes) {
      expect(JSON.parse(JSON.stringify(theme))).toEqual(theme);
    }
  });

  it("gives each variant id one label across a theme's palettes", () => {
    for (const theme of builtinThemes) {
      expect(() => variantsOf(theme), theme.id).not.toThrow();
    }
  });

  it("can be imported one theme at a time", async () => {
    const { dracula } = await import("../src/themes/dracula.ts");
    expect(builtinThemes).toContain(dracula);
  });
});

describe("the port from @orz/ui's styles.css", () => {
  // Scraped once from styles.css before its [data-theme] blocks were deleted.
  const legacy: Record<string, Record<string, string>> = JSON.parse(
    readFileSync(
      join(import.meta.dirname, "fixtures/legacy-tokens.json"),
      "utf8",
    ),
  );
  const PORTED: Record<string, [string, ColorScheme]> = {
    light: ["default", "light"],
    dark: ["default", "dark"],
    "pico-light": ["picotera", "light"],
    "tera-dark": ["picotera", "dark"],
    "solarized-light": ["solarized", "light"],
    "solarized-dark": ["solarized", "dark"],
    "vs-light": ["vs", "light"],
    "vs-dark": ["vs", "dark"],
    "github-light": ["github", "light"],
    "github-dark": ["github", "dark"],
    "catppuccin-latte": ["catppuccin", "light"],
    "catppuccin-mocha": ["catppuccin", "dark"],
    "gruvbox-light": ["gruvbox", "light"],
    "gruvbox-dark": ["gruvbox", "dark"],
    dracula: ["dracula", "dark"],
    nord: ["nord", "dark"],
    "tokyo-night": ["tokyo-night", "dark"],
    "one-dark": ["one-dark", "dark"],
    monokai: ["monokai", "dark"],
  };

  it("covers every old slug", () => {
    expect(Object.keys(PORTED).sort()).toEqual(Object.keys(legacy).sort());
  });

  // Darkened or lightened after the port to clear AA as text or 3:1 as a
  // focus ring; contrast.test.ts and focus-ring.test.ts hold them instead. The
  // fixture stays as scraped.
  const RETUNED: Record<string, string[]> = {
    light: ["muted-foreground", "ring", "sidebar-ring"],
    "pico-light": ["destructive"],
    "solarized-light": [
      "muted-foreground",
      "destructive",
      "ring",
      "sidebar-ring",
    ],
    "solarized-dark": ["muted-foreground", "destructive"],
    "gruvbox-light": ["muted-foreground"],
    "gruvbox-dark": ["destructive"],
    dracula: ["destructive"],
    nord: ["destructive"],
    "one-dark": ["muted-foreground"],
    monokai: ["destructive"],
  };
  // Added after the port, so the scraped fixture has no value for them.
  const ADDED = ["success", "warning"];
  // Raised in every palette to clear 3:1 as a field's edge;
  // field-contrast.test.ts holds it instead.
  const RAISED = ["input"];
  const without = (tokens: Record<string, string>, names: string[] = []) =>
    Object.fromEntries(
      Object.entries(tokens).filter(
        ([name]) =>
          !names.includes(name) &&
          !ADDED.includes(name) &&
          !RAISED.includes(name),
      ),
    );

  // Rebuilt from catppuccin/palette after the port; no ported value is meant
  // to survive.
  const REBUILT = ["catppuccin-latte", "catppuccin-mocha"];

  it.each(Object.entries(PORTED).filter(([slug]) => !REBUILT.includes(slug)))(
    "changed no UI value of %s",
    (slug, [id, scheme]) => {
      const theme = builtinThemes.find((t) => t.id === id) as Theme;
      const tokens = resolvePalette(theme, scheme)?.tokens ?? {};
      expect(without(tokens, RETUNED[slug])).toEqual(
        without(legacy[slug], RETUNED[slug]),
      );
    },
  );
});
