import { describe, expect, it } from "vitest";
import {
  builtinThemes,
  resolvePalette,
  schemesOf,
  variantsOf,
} from "../src/index.ts";

// Copied verbatim from @pierre/theming's shiki collection rather than
// imported: a name absent from it throws UnregisteredThemeError at render
// time, and importing the real list would let an upstream rename silently
// take our mapping with it.
const SHIKI_THEMES = new Set([
  "ayu-light",
  "catppuccin-latte",
  "everforest-light",
  "github-light",
  "github-light-default",
  "github-light-high-contrast",
  "gruvbox-light-hard",
  "gruvbox-light-medium",
  "gruvbox-light-soft",
  "horizon-bright",
  "kanagawa-lotus",
  "light-plus",
  "material-theme-lighter",
  "min-light",
  "night-owl-light",
  "one-light",
  "rose-pine-dawn",
  "slack-ochin",
  "snazzy-light",
  "solarized-light",
  "vitesse-light",
  "andromeeda",
  "aurora-x",
  "ayu-dark",
  "ayu-mirage",
  "catppuccin-frappe",
  "catppuccin-macchiato",
  "catppuccin-mocha",
  "dark-plus",
  "dracula",
  "dracula-soft",
  "everforest-dark",
  "github-dark",
  "github-dark-default",
  "github-dark-dimmed",
  "github-dark-high-contrast",
  "gruvbox-dark-hard",
  "gruvbox-dark-medium",
  "gruvbox-dark-soft",
  "horizon",
  "houston",
  "kanagawa-dragon",
  "kanagawa-wave",
  "laserwave",
  "material-theme",
  "material-theme-darker",
  "material-theme-ocean",
  "material-theme-palenight",
  "min-dark",
  "monokai",
  "night-owl",
  "nord",
  "one-dark-pro",
  "plastic",
  "poimandres",
  "red",
  "rose-pine",
  "rose-pine-moon",
  "slack-dark",
  "solarized-dark",
  "synthwave-84",
  "tokyo-night",
  "vesper",
  "vitesse-black",
  "vitesse-dark",
]);

const sides = builtinThemes.flatMap((theme) =>
  schemesOf(theme).flatMap((scheme) =>
    variantsOf(theme).map(({ id }) => ({
      name: `${theme.id} ${scheme} ${id}`,
      scheme,
      variant: id,
      syntax: resolvePalette(theme, scheme, id)?.syntax,
    })),
  ),
);

describe("syntax themes", () => {
  it("only names themes shiki actually bundles", () => {
    const unknown = sides.filter(
      (s) => s.syntax !== undefined && !SHIKI_THEMES.has(s.syntax),
    );
    expect(unknown.map((s) => `${s.name}: ${s.syntax}`)).toEqual([]);
  });

  it("keeps a mapped syntax theme on the same side as the palette", () => {
    // A dark palette paired with a light syntax theme would read as a
    // bright code block on a dark page, which is the T-144 bug inverted.
    for (const { name, scheme, syntax } of sides) {
      if (syntax === undefined) continue;
      expect(
        syntax.includes("light") || syntax === "catppuccin-latte",
        name,
      ).toBe(scheme === "light");
    }
  });

  it("never maps two palettes on one side to the same syntax theme", () => {
    // Not a correctness requirement of pierre's, but a duplicate is a
    // copy-paste slip in a table this repetitive. ProNord and ProLavender
    // are Nord and Catppuccin's colours, so they share those on purpose.
    const SHARED = new Set(["pro-nord", "pro-lavender"]);
    for (const scheme of ["light", "dark"] as const) {
      const mapped = builtinThemes
        .filter((theme) => !SHARED.has(theme.id))
        .map((theme) => theme[scheme]?.syntax)
        .filter((s): s is string => s !== undefined);
      expect(new Set(mapped).size, scheme).toBe(mapped.length);
    }
  });
});
