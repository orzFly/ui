import { describe, expect, it } from "vitest";
import { composeTheme, type Palette, resolvePalette } from "../src/index.ts";
import { duo, ink, night, term, terminal, tokens } from "./fixtures.ts";

const themes = [duo, night, term, ink];

describe("composeTheme", () => {
  it("copies a based side's base, with its syntax and terminal", () => {
    const theme = composeTheme(
      { id: "c", label: "Custom", light: { base: { theme: "duo" } } },
      themes,
    );
    expect(theme).toEqual({
      id: "c",
      label: "Custom",
      light: {
        tokens: tokens(0.9),
        terminal: terminal("#eeeeee"),
        syntax: "duo-light",
      },
    });
  });

  it("spreads overrides over the base, and resolves the base's variant", () => {
    const theme = composeTheme(
      {
        id: "c",
        label: "Custom",
        dark: {
          base: { theme: "duo", variant: "dim" },
          tokens: { primary: "oklch(0.7 0.2 30)" },
        },
      },
      themes,
    );
    const dim = resolvePalette(duo, "dark", "dim");
    expect(theme?.dark?.tokens).toEqual({
      ...dim?.tokens,
      primary: "oklch(0.7 0.2 30)",
    });
    expect(theme?.dark?.terminal["ansi-red"]).toBe("#880000");
    expect(theme?.dark?.syntax).toBe("duo-dark");
    expect(theme?.dark).not.toHaveProperty("variants");
    expect(theme).not.toHaveProperty("light");
  });

  it("takes a detached side as written, with no syntax", () => {
    const theme = composeTheme(
      {
        id: "c",
        label: "Custom",
        light: {
          tokens: tokens(0.7),
          terminal: { tokens: terminal("#777777") },
        },
      },
      themes,
    );
    expect(theme?.light).toEqual({
      tokens: tokens(0.7),
      terminal: terminal("#777777"),
    });
  });

  describe("terminal", () => {
    const side = (t: object) =>
      composeTheme(
        {
          id: "c",
          label: "Custom",
          light: { base: { theme: "duo" }, terminal: t as never },
        },
        themes,
      )?.light?.terminal;

    it("bases on another theme's same side", () => {
      expect(side({ base: { theme: "term" } })).toEqual(terminal("#fafafa"));
    });

    it("pins another scheme and variant", () => {
      expect(
        side({ base: { theme: "term", scheme: "dark", variant: "hc" } }),
      ).toEqual(terminal("#0a0a0a", { "ansi-red": "#ff0000" }));
    });

    it("falls back to a one-palette base's only side", () => {
      expect(side({ base: { theme: "ink" } })).toEqual(terminal("#050505"));
      expect(side({ base: { theme: "night" } })).toEqual(terminal("#111111"));
    });

    it("spreads overrides over its base", () => {
      expect(
        side({ base: { theme: "ink" }, tokens: { "ansi-red": "#ff1111" } }),
      ).toEqual(terminal("#050505", { "ansi-red": "#ff1111" }));
    });

    it("takes a detached terminal as written", () => {
      expect(side({ tokens: terminal("#abcdef") })).toEqual(
        terminal("#abcdef"),
      );
    });

    it("falls back to the side's own base when its base is missing", () => {
      expect(side({ base: { theme: "gone" } })).toEqual(terminal("#eeeeee"));
      // Pinned to a scheme the base lacks counts as missing too.
      expect(side({ base: { theme: "ink", scheme: "light" } })).toEqual(
        terminal("#eeeeee"),
      );
    });
  });

  it("drops a side whose base is missing, lacks the scheme or is terminal-only", () => {
    const theme = composeTheme(
      {
        id: "c",
        label: "Custom",
        light: { base: { theme: "night" } },
        dark: { base: { theme: "duo" } },
      },
      themes,
    );
    expect(theme).not.toHaveProperty("light");
    expect(theme?.dark?.tokens).toEqual(tokens(0.2));

    expect(
      composeTheme(
        { id: "c", label: "Custom", dark: { base: { theme: "term" } } },
        themes,
      ),
    ).toBeNull();
  });

  it("drops a detached side whose terminal base is missing", () => {
    expect(
      composeTheme(
        {
          id: "c",
          label: "Custom",
          dark: { tokens: tokens(0.1), terminal: { base: { theme: "gone" } } },
        },
        themes,
      ),
    ).toBeNull();
  });

  it("is null when no side survives", () => {
    expect(
      composeTheme(
        {
          id: "c",
          label: "Custom",
          light: { base: { theme: "gone" } },
          dark: { base: { theme: "gone" } },
        },
        themes,
      ),
    ).toBeNull();
    expect(composeTheme({ id: "c", label: "Custom" }, themes)).toBeNull();
  });

  it("follows its base when the base changes", () => {
    const custom = {
      id: "c",
      label: "Custom",
      dark: { base: { theme: "night" } },
    };
    const retuned = {
      ...night,
      dark: { ...(night.dark as Palette), tokens: tokens(0.05) },
    };
    expect(composeTheme(custom, [retuned])?.dark?.tokens).toEqual(tokens(0.05));
  });

  it("returns plain data", () => {
    const theme = composeTheme(
      {
        id: "c",
        label: "Custom",
        light: { base: { theme: "duo", variant: "soft" } },
        dark: { tokens: tokens(0.1), terminal: { base: { theme: "ink" } } },
      },
      themes,
    );
    expect(JSON.parse(JSON.stringify(theme))).toEqual(theme);
  });
});
