import { dracula, type TerminalTokens } from "@orz/themes";
import { formatColor, parseColor } from "@orz/ui/lib/color";
import { describe, expect, it } from "vitest";
import { ANSI_ORDER, playerThemeVars } from "../src/player-theme.ts";

const base = dracula.dark?.terminal as TerminalTokens;

describe("playerThemeVars", () => {
  it("maps a built-in theme to all 18 of the player's colours, each #rrggbb", () => {
    const vars = playerThemeVars(base);
    expect(Object.keys(vars)).toHaveLength(18);
    for (const value of Object.values(vars)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("orders the palette normal 0–7, then bright 8–15", () => {
    expect(ANSI_ORDER[9]).toBe("ansi-bright-red");
    const vars = playerThemeVars({
      ...base,
      "ansi-red": "#110000",
      "ansi-bright-red": "#ff0000",
      "ansi-white": "#eeeeee",
    });
    expect(vars["--term-color-1"]).toBe("#110000");
    expect(vars["--term-color-7"]).toBe("#eeeeee");
    expect(vars["--term-color-9"]).toBe("#ff0000");
  });

  it("expands #rgb", () => {
    const vars = playerThemeVars({ ...base, "terminal-foreground": "#abc" });
    expect(vars["--term-color-foreground"]).toBe("#aabbcc");
  });

  it("converts oklch to the hex formatColor gives", () => {
    const oklch = "oklch(0.7 0.15 150)";
    const parsed = parseColor(oklch);
    if (parsed === null) throw new Error("unparsed");
    const vars = playerThemeVars({ ...base, "terminal-background": oklch });
    expect(vars["--term-color-background"]).toBe(
      formatColor(parsed.color, "hex", { alpha: false }),
    );
    expect(vars["--term-color-background"]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("drops alpha", () => {
    const vars = playerThemeVars({
      ...base,
      "ansi-green": "rgb(34 197 94 / 50%)",
    });
    expect(vars["--term-color-2"]).toBe("#22c55e");
  });

  it("leaves out a token that does not parse", () => {
    const vars = playerThemeVars({ ...base, "ansi-blue": "not a colour" });
    expect(vars).not.toHaveProperty("--term-color-4");
    expect(Object.keys(vars)).toHaveLength(17);
  });
});
