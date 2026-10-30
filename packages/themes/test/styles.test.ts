import { describe, expect, it } from "vitest";
import {
  builtinThemes,
  composeTheme,
  DEFAULT_STYLE,
  defaultStyle,
  raymondStyle,
  renderDeclarations,
  resolvePalette,
  stylesOf,
  type Theme,
  themesForStyle,
} from "../src/index.ts";
import { duo, night, terminal, tokens } from "./fixtures.ts";

/** A theme of a second style, whose palette supplies that style's tokens. */
const bevel: Theme = {
  id: "bevel",
  label: "Bevel",
  styles: ["bevel"],
  light: {
    tokens: tokens(0.8),
    terminal: terminal("#cccccc"),
    styleTokens: { "3d-face": "#d4d0c8", "3d-shadow": "#808080" },
  },
};
/** In both styles. */
const both: Theme = { ...night, id: "both", styles: ["default", "bevel"] };

describe("styles", () => {
  it("puts a theme that names no style in the default one", () => {
    expect(defaultStyle).toEqual({ id: DEFAULT_STYLE, label: "Default" });
    expect(stylesOf(duo)).toEqual(["default"]);
    expect(stylesOf(bevel)).toEqual(["bevel"]);
  });

  it("keeps every built-in theme but raymond's in the default style by omission", () => {
    const raymond = builtinThemes.filter((theme) => theme.styles);
    expect(raymond.map((theme) => theme.id)).toEqual(["windows-standard"]);
    expect(themesForStyle(builtinThemes, DEFAULT_STYLE)).toEqual(
      builtinThemes.filter((theme) => !raymond.includes(theme)),
    );
    expect(themesForStyle(builtinThemes, raymondStyle.id)).toEqual(raymond);
  });

  it("gives each raymond palette exactly the style's tokens", () => {
    for (const theme of themesForStyle(builtinThemes, raymondStyle.id)) {
      for (const scheme of ["light", "dark"] as const) {
        const palette = theme[scheme];
        if (!palette) continue;
        expect(Object.keys(palette.styleTokens ?? {}), theme.id).toEqual(
          raymondStyle.tokens,
        );
      }
    }
  });

  it("lists a style's themes in their order", () => {
    const themes = [bevel, duo, both, night];
    expect(themesForStyle(themes, "default")).toEqual([duo, both, night]);
    expect(themesForStyle(themes, "bevel")).toEqual([bevel, both]);
    expect(themesForStyle(themes, "other")).toEqual([]);
  });

  it("resolves and renders a palette's style tokens after the UI tokens", () => {
    const palette = resolvePalette(bevel, "light");
    expect(palette?.styleTokens).toEqual(bevel.light?.styleTokens);
    const text = renderDeclarations(tokens(0.8), "light", palette?.styleTokens);
    expect(
      text.endsWith(
        "--sidebar-ring: oklch(0.8 0 0); --3d-face: #d4d0c8; --3d-shadow: #808080;",
      ),
    ).toBe(true);
    expect(resolvePalette(duo, "light")).not.toHaveProperty("styleTokens");
  });

  it("survives a JSON round trip with styles and style tokens", () => {
    expect(JSON.parse(JSON.stringify(bevel))).toEqual(bevel);
  });
});

describe("a custom theme's styles", () => {
  const themes = [duo, night, bevel];

  it("are its base theme's, style tokens included", () => {
    const theme = composeTheme(
      { id: "c", label: "C", light: { base: { theme: "bevel" } } },
      themes,
    );
    expect(theme?.styles).toEqual(["bevel"]);
    expect(theme?.light?.styleTokens).toEqual(bevel.light?.styleTokens);
    // The recorded style is for a fully custom side; a based one ignores it.
    const based = composeTheme(
      {
        id: "c",
        label: "C",
        style: "bevel",
        dark: { base: { theme: "night" } },
      },
      themes,
    );
    expect(based).not.toHaveProperty("styles");
  });

  it("are the style a fully custom theme was made under", () => {
    const side = {
      tokens: tokens(0.5),
      terminal: { tokens: terminal("#555") },
    };
    expect(
      composeTheme({ id: "c", label: "C", style: "bevel", dark: side }, themes)
        ?.styles,
    ).toEqual(["bevel"]);
    expect(
      composeTheme({ id: "c", label: "C", dark: side }, themes),
    ).not.toHaveProperty("styles");
  });

  it("join both sides' styles, leaving out a side that does not compose", () => {
    const theme = composeTheme(
      {
        id: "c",
        label: "C",
        light: { base: { theme: "bevel" } },
        dark: { base: { theme: "night" } },
      },
      themes,
    );
    expect(theme?.styles).toEqual(["bevel", "default"]);
    const gone = composeTheme(
      {
        id: "c",
        label: "C",
        light: { base: { theme: "missing" } },
        dark: { base: { theme: "night" } },
      },
      themes,
    );
    expect(gone).not.toHaveProperty("styles");
  });
});
