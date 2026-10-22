// Type-only @orz imports: the manager's esbuild bundles this file too.
import type { ResolvedTheme, Theme } from "@orz/ui/theme";
import { create, type ThemeVars } from "storybook/theming";

// Storybook's theming runs every colour through polished, which cannot parse
// oklch. Painting a token onto a canvas and reading the pixel back lets the
// browser do the conversion, gamut mapping and var() resolution included.
const canvas = document
  .createElement("canvas")
  .getContext("2d", { willReadFrequently: true });

function token(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(
    `--${name}`,
  );
  if (canvas === null) return value;
  canvas.clearRect(0, 0, 1, 1);
  canvas.fillStyle = "transparent";
  canvas.fillStyle = value;
  canvas.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`;
}

// Keyed on the theme object, not its id: a custom theme saved again under the
// same id is a new object, and must not keep its old chrome.
const varsCache = new WeakMap<Theme, Map<string, ThemeVars>>();

/**
 * Storybook's theme vars for the theme this document's store has just
 * painted. Reads the tokens off `<html>`, so it must only be called for the
 * store's current theme; the cache keys on that.
 */
export function storybookTheme({
  theme,
  colorScheme,
  variant,
}: ResolvedTheme): ThemeVars {
  let byPalette = varsCache.get(theme);
  if (byPalette === undefined) {
    byPalette = new Map();
    varsCache.set(theme, byPalette);
  }
  const key = `${colorScheme}:${variant}`;
  let vars = byPalette.get(key);
  if (vars === undefined) {
    vars = create({
      base: colorScheme,
      colorPrimary: token("primary"),
      // Storybook draws the selected sidebar item in white on this.
      colorSecondary: token("sidebar-primary"),
      appBg: token("sidebar"),
      appContentBg: token("background"),
      appPreviewBg: token("background"),
      appHoverBg: token("accent"),
      appBorderColor: token("border"),
      textColor: token("foreground"),
      textMutedColor: token("muted-foreground"),
      textInverseColor: token("primary-foreground"),
      barBg: token("background"),
      barTextColor: token("muted-foreground"),
      buttonBg: token("secondary"),
      buttonBorder: token("border"),
      booleanBg: token("muted"),
      booleanSelectedBg: token("background"),
      inputBg: token("background"),
      inputBorder: token("input"),
      inputTextColor: token("foreground"),
    });
    byPalette.set(key, vars);
  }
  return vars;
}
