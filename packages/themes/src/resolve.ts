import { DEFAULT_VARIANT } from "./tokens.ts";
import type {
  ColorScheme,
  Palette,
  ResolvedPalette,
  ResolvedTerminal,
  TerminalPalette,
  TerminalTheme,
  Theme,
} from "./types.ts";

const SCHEMES: readonly ColorScheme[] = ["light", "dark"];

/** The color schemes the theme has, light first. */
export function schemesOf(theme: TerminalTheme): ColorScheme[] {
  return SCHEMES.filter((scheme) => theme[scheme] !== undefined);
}

// Own keys only: a variant id comes from a stored pref, and "constructor"
// must not find Object.prototype's.
function variantOf<V>(
  variants: Record<string, V> | undefined,
  id: string | undefined,
): V | undefined {
  if (id === undefined || id === DEFAULT_VARIANT || variants === undefined) {
    return undefined;
  }
  return Object.hasOwn(variants, id) ? variants[id] : undefined;
}

/**
 * `default` (label "Default") first, then each id in palette order (light,
 * then dark), once. Throws when two palettes give one id different labels,
 * which would leave a menu showing one entry that means two things.
 */
export function variantsOf(
  theme: TerminalTheme,
): { id: string; label: string }[] {
  const out = [{ id: DEFAULT_VARIANT, label: "Default" }];
  for (const scheme of schemesOf(theme)) {
    const variants = theme[scheme]?.variants ?? {};
    for (const [id, { label }] of Object.entries(variants)) {
      if (id === DEFAULT_VARIANT) continue;
      const seen = out.find((v) => v.id === id);
      if (seen === undefined) out.push({ id, label });
      else if (seen.label !== label) {
        throw new Error(
          `theme ${theme.id}: variant ${id} is "${seen.label}" on one side and "${label}" on the other`,
        );
      }
    }
  }
  return out;
}

/** True when every palette of the theme carries UI tokens. */
export function isUiTheme(theme: TerminalTheme): theme is Theme {
  return schemesOf(theme).every(
    (scheme) => (theme[scheme] as Partial<Palette>).tokens !== undefined,
  );
}

/** null when the theme has no palette for `scheme`. An unknown variant resolves to default. */
export function resolvePalette(
  theme: Theme,
  scheme: ColorScheme,
  variant?: string,
): ResolvedPalette | null {
  const palette: Palette | undefined = theme[scheme];
  if (palette === undefined) return null;
  const picked = variantOf(palette.variants, variant);
  const resolved: ResolvedPalette = {
    tokens: { ...palette.tokens, ...picked?.tokens },
    terminal: { ...palette.terminal, ...picked?.terminal },
    variant: picked === undefined ? DEFAULT_VARIANT : (variant as string),
  };
  const syntax = picked?.syntax ?? palette.syntax;
  if (syntax !== undefined) resolved.syntax = syntax;
  return resolved;
}

export function resolveTerminal(
  theme: TerminalTheme,
  scheme: ColorScheme,
  variant?: string,
): ResolvedTerminal | null {
  const palette: TerminalPalette | undefined = theme[scheme];
  if (palette === undefined) return null;
  const picked = variantOf(palette.variants, variant);
  return {
    terminal: { ...palette.terminal, ...picked?.terminal },
    variant: picked === undefined ? DEFAULT_VARIANT : (variant as string),
  };
}
