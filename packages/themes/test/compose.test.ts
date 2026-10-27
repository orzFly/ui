import { describe, expect, it } from "vitest";
import {
  composeTerminalTheme,
  composeTheme,
  isCustomTerminalTheme,
  LATE_TOKEN_NAMES,
  type Palette,
  resolvePalette,
  type TokenName,
  type Tokens,
} from "../src/index.ts";
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

  it("gives a detached side saved before success and warning its own diff-addition and yellow", () => {
    const saved = Object.fromEntries(
      Object.entries(tokens(0.7, { "diff-addition": "#18a46c" })).filter(
        ([name]) => !LATE_TOKEN_NAMES.includes(name as TokenName),
      ),
    ) as Tokens;
    const theme = composeTheme(
      {
        id: "c",
        label: "Custom",
        dark: {
          tokens: saved,
          terminal: {
            tokens: terminal("#777777", { "ansi-yellow": "#b58900" }),
          },
        },
      },
      themes,
    );
    expect(theme?.dark?.tokens).toEqual({
      ...saved,
      success: "#18a46c",
      warning: "#b58900",
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

describe("composeTerminalTheme", () => {
  const compose = (sides: object) =>
    composeTerminalTheme(
      { id: "t", kind: "terminal", label: "Term custom", ...sides },
      themes,
    );

  it("bases a side on a terminal-only theme and on a UI theme", () => {
    expect(
      compose({
        light: { base: { theme: "term" } },
        dark: { base: { theme: "duo" } },
      }),
    ).toEqual({
      id: "t",
      label: "Term custom",
      light: { terminal: terminal("#fafafa") },
      dark: { terminal: terminal("#222222") },
    });
  });

  it("takes the pinned scheme, else the side's own, else the base's only one", () => {
    expect(
      compose({ light: { base: { theme: "term", scheme: "dark" } } })?.light,
    ).toEqual({ terminal: terminal("#0a0a0a") });
    expect(compose({ dark: { base: { theme: "term" } } })?.dark).toEqual({
      terminal: terminal("#0a0a0a"),
    });
    expect(compose({ light: { base: { theme: "ink" } } })?.light).toEqual({
      terminal: terminal("#050505"),
    });
  });

  it("applies a variant, and falls back to default for an unknown one", () => {
    expect(
      compose({ dark: { base: { theme: "term", variant: "hc" } } })?.dark
        ?.terminal,
    ).toEqual(terminal("#0a0a0a", { "ansi-red": "#ff0000" }));
    expect(
      compose({ dark: { base: { theme: "term", variant: "nope" } } })?.dark
        ?.terminal,
    ).toEqual(terminal("#0a0a0a"));
  });

  it("spreads overrides over the base, after the variant", () => {
    expect(
      compose({
        dark: {
          base: { theme: "duo", variant: "dim" },
          tokens: { "ansi-blue": "#0000ff" },
        },
      })?.dark?.terminal,
    ).toEqual(
      terminal("#222222", { "ansi-red": "#880000", "ansi-blue": "#0000ff" }),
    );
  });

  it("takes a detached side as written", () => {
    expect(compose({ light: { tokens: terminal("#abcdef") } })?.light).toEqual({
      terminal: terminal("#abcdef"),
    });
  });

  it("drops a side whose base is missing or lacks the scheme", () => {
    expect(
      compose({
        light: { base: { theme: "gone" } },
        dark: { base: { theme: "ink", scheme: "light" } },
      }),
    ).toBeNull();
    const one = compose({
      light: { base: { theme: "gone" } },
      dark: { base: { theme: "ink" } },
    });
    expect(one).not.toHaveProperty("light");
    expect(one?.dark).toEqual({ terminal: terminal("#050505") });
  });

  it("is null with no sides", () => {
    expect(compose({})).toBeNull();
  });

  it("carries terminal only: no label, no variants, no UI tokens", () => {
    const theme = compose({
      light: { base: { theme: "duo", variant: "soft" } },
      dark: { base: { theme: "term" } },
    });
    expect(Object.keys(theme?.light ?? {})).toEqual(["terminal"]);
    expect(Object.keys(theme?.dark ?? {})).toEqual(["terminal"]);
    expect(JSON.parse(JSON.stringify(theme))).toEqual(theme);
  });
});

describe("isCustomTerminalTheme", () => {
  it("tells the kinds apart", () => {
    expect(
      isCustomTerminalTheme({ id: "t", kind: "terminal", label: "T" }),
    ).toBe(true);
    expect(isCustomTerminalTheme({ id: "c", kind: "ui", label: "C" })).toBe(
      false,
    );
    expect(
      isCustomTerminalTheme({
        id: "c",
        label: "C",
        light: { base: { theme: "duo" } },
      }),
    ).toBe(false);
  });
});
