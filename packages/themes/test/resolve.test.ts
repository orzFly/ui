import { describe, expect, it } from "vitest";
import {
  isUiTheme,
  type Palette,
  resolvePalette,
  resolveTerminal,
  schemesOf,
  type Theme,
  variantsOf,
} from "../src/index.ts";
import { duo, ink, night, term, terminal, tokens } from "./fixtures.ts";

describe("schemesOf", () => {
  it("lists the sides a theme has, light first", () => {
    expect(schemesOf(duo)).toEqual(["light", "dark"]);
    expect(schemesOf(night)).toEqual(["dark"]);
    expect(schemesOf(ink)).toEqual(["dark"]);
  });
});

describe("variantsOf", () => {
  it("unions the palettes' ids after default, light side first, once each", () => {
    expect(variantsOf(duo)).toEqual([
      { id: "default", label: "Default" },
      { id: "soft", label: "Soft" },
      { id: "dim", label: "Dim" },
    ]);
    expect(variantsOf(night)).toEqual([{ id: "default", label: "Default" }]);
    expect(variantsOf(term).map((v) => v.id)).toEqual(["default", "hc"]);
  });

  it("throws when one id carries two labels", () => {
    const split: Theme = {
      ...duo,
      dark: {
        ...(duo.dark as Palette),
        variants: { soft: { label: "Softer" } },
      },
    };
    expect(() => variantsOf(split)).toThrow(/soft/);
  });
});

describe("isUiTheme", () => {
  it("tells UI themes from terminal-only ones", () => {
    expect(isUiTheme(duo)).toBe(true);
    expect(isUiTheme(night)).toBe(true);
    expect(isUiTheme(term)).toBe(false);
    expect(isUiTheme(ink)).toBe(false);
  });
});

describe("resolvePalette", () => {
  it("returns the palette itself for default", () => {
    const resolved = resolvePalette(duo, "light");
    expect(resolved).toEqual({
      tokens: tokens(0.9),
      terminal: terminal("#eeeeee"),
      syntax: "duo-light",
      variant: "default",
    });
  });

  it("spreads a variant over UI and terminal tokens, and its syntax over the palette's", () => {
    const dim = resolvePalette(duo, "dark", "dim");
    expect(dim?.variant).toBe("dim");
    expect(dim?.tokens.foreground).toBe("oklch(0.6 0 0)");
    expect(dim?.tokens.background).toBe("oklch(0.2 0 0)");
    expect(dim?.terminal["ansi-red"]).toBe("#880000");
    expect(dim?.terminal["ansi-blue"]).toBe("#222222");
    expect(dim?.syntax).toBe("duo-dark");

    expect(resolvePalette(duo, "light", "soft")?.syntax).toBe("duo-soft");
  });

  it("resolves a variant the side lacks, or no theme defines, to default", () => {
    const lightDim = resolvePalette(duo, "light", "dim");
    expect(lightDim?.variant).toBe("default");
    expect(lightDim?.tokens).toEqual(tokens(0.9));
    expect(resolvePalette(duo, "dark", "nope")?.variant).toBe("default");
    expect(resolvePalette(duo, "dark", "constructor")?.variant).toBe("default");
  });

  it("is null for a missing side, and omits an absent syntax", () => {
    expect(resolvePalette(night, "light")).toBeNull();
    expect(resolvePalette(night, "dark")).not.toHaveProperty("syntax");
  });

  it("never hands back the palette's own objects", () => {
    const resolved = resolvePalette(duo, "light");
    expect(resolved?.tokens).not.toBe(duo.light?.tokens);
    expect(resolved?.terminal).not.toBe(duo.light?.terminal);
  });
});

describe("resolveTerminal", () => {
  it("resolves terminal-only and UI themes alike", () => {
    expect(resolveTerminal(term, "dark", "hc")).toEqual({
      terminal: terminal("#0a0a0a", { "ansi-red": "#ff0000" }),
      variant: "hc",
    });
    expect(resolveTerminal(term, "light", "hc")?.variant).toBe("default");
    expect(resolveTerminal(duo, "dark", "dim")?.terminal["ansi-red"]).toBe(
      "#880000",
    );
    expect(resolveTerminal(ink, "light")).toBeNull();
  });
});
