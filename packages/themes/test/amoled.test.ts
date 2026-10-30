import { describe, expect, it } from "vitest";
import { amoled } from "../src/index.ts";
import { contrast, rgbOf } from "../src/rgb.ts";
import { terminal, tokens } from "./fixtures.ts";

const palette = {
  tokens: tokens(0.95, {
    background: "oklch(0.2 0.02 260)",
    card: "oklch(0.25 0.02 260)",
    popover: "oklch(0.25 0.02 260)",
    secondary: "oklch(0.3 0.03 250)",
    muted: "oklch(0.3 0.03 250)",
    accent: "oklch(0.35 0.09 262)",
    sidebar: "oklch(0.18 0.02 260)",
    "sidebar-accent": "oklch(0.3 0.03 250)",
    border: "oklch(1 0 0 / 10%)",
    input: "oklch(1 0 0 / 15%)",
    "sidebar-border": "oklch(0.32 0.02 255)",
    "diff-addition": "#07c480",
  }),
  terminal: terminal("#ff00ff", { "terminal-background": "#1a1b26" }),
};

describe("amoled", () => {
  const variant = amoled(palette);

  it("takes the background to black, on screen and in the terminal", () => {
    expect(variant.label).toBe("AMOLED");
    expect(variant.tokens?.background).toBe("oklch(0 0 0)");
    expect(variant.terminal).toEqual({ "terminal-background": "#000000" });
  });

  it("drops each panel by the background's lightness, keeping its hue", () => {
    expect(variant.tokens?.card).toBe("oklch(0.05 0.02 260)");
    expect(variant.tokens?.popover).toBe("oklch(0.05 0.02 260)");
    // Darker than the background clamps at black.
    expect(variant.tokens?.sidebar).toBe("oklch(0 0 0)");
  });

  it("lifts fills, highlights and opaque borders to keep their contrast with the background", () => {
    const original = palette.tokens;
    const black = rgbOf("oklch(0 0 0)");
    for (const name of [
      "secondary",
      "muted",
      "accent",
      "sidebar-accent",
      "sidebar-border",
    ] as const) {
      const lifted = variant.tokens?.[name] ?? "";
      expect(lifted.split(" ").slice(1), name).toEqual(
        original[name].split(" ").slice(1),
      );
      expect(contrast(rgbOf(lifted), black), name).toBeCloseTo(
        contrast(rgbOf(original[name]), rgbOf(original.background)),
        1,
      );
    }
    expect(variant.tokens?.accent).toBe("oklch(0.312 0.09 262)");
  });

  it("leaves text, accents, alpha values and ANSI colours alone", () => {
    expect(Object.keys(variant.tokens ?? {}).sort()).toEqual(
      [
        "accent",
        "background",
        "card",
        "marker",
        "muted",
        "popover",
        "secondary",
        "sidebar",
        "sidebar-accent",
        "sidebar-border",
      ].sort(),
    );
  });

  it("skips the UI side when the background is not a plain oklch()", () => {
    const hex = amoled({
      ...palette,
      tokens: { ...palette.tokens, background: "#101010" },
    });
    expect(hex.tokens).toEqual({});
    expect(hex.terminal).toEqual({ "terminal-background": "#000000" });
  });
});
