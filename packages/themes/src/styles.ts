import type { Style, Theme } from "./types.ts";

export const DEFAULT_STYLE = "default";

/** The style `@orz/ui`'s own stylesheet draws: it has no `[data-style]` rules. */
export const defaultStyle: Style = { id: DEFAULT_STYLE, label: "Default" };

/**
 * Windows 2000, drawn by `@orz/ui/styles/raymond.css`. Its palettes supply the
 * 3D face and its four edge colours, the window (field) colour, the active and
 * inactive caption gradients, and the tooltip's info colours.
 */
export const raymondStyle: Style = {
  id: "raymond",
  label: "Raymond",
  tokens: [
    "3d-face",
    "3d-highlight",
    "3d-light",
    "3d-shadow",
    "3d-dark-shadow",
    "window",
    "caption",
    "caption-gradient",
    "caption-foreground",
    "caption-inactive",
    "caption-inactive-gradient",
    "caption-inactive-foreground",
    "info",
    "info-foreground",
  ],
};

/** The styles a theme belongs to. */
export function stylesOf(theme: Theme): readonly string[] {
  return theme.styles ?? [DEFAULT_STYLE];
}

/** The themes that belong to `styleId`, in their order. */
export function themesForStyle<T extends Theme>(
  themes: readonly T[],
  styleId: string,
): T[] {
  return themes.filter((theme) => stylesOf(theme).includes(styleId));
}
