import type { Style, Theme } from "./types.ts";

export const DEFAULT_STYLE = "default";

/** The style `@orz/ui`'s own stylesheet draws: it has no `[data-style]` rules. */
export const defaultStyle: Style = { id: DEFAULT_STYLE, label: "Default" };

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
