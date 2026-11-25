import {
  builtinThemes,
  resolvePalette,
  schemesOf,
  stylesOf,
  type Tokens,
  variantsOf,
} from "../src/index.ts";

/**
 * Every palette under every variant the theme offers; a variant a side lacks
 * resolves to that side's default, which is what the page shows. A variant
 * that paints a side exactly as an earlier one does is listed once, under the
 * earlier name, so an exemption names each painted palette once.
 */
export const resolvedPalettes: {
  name: string;
  tokens: Tokens;
  styles: readonly string[];
}[] = builtinThemes.flatMap((theme) =>
  schemesOf(theme).flatMap((scheme) => {
    const seen = new Set<string>();
    return variantsOf(theme).flatMap(({ id }) => {
      // biome-ignore lint/style/noNonNullAssertion: schemesOf lists only present sides
      const { tokens } = resolvePalette(theme, scheme, id)!;
      const key = JSON.stringify(tokens);
      if (seen.has(key)) return [];
      seen.add(key);
      return [
        {
          name: `${theme.id} ${scheme} ${id}`,
          tokens,
          styles: stylesOf(theme),
        },
      ];
    });
  }),
);

/**
 * Pairs kept below a test's floor on purpose, by test and row name, each
 * holding the lowest ratio it may fall to: the palette's own, rounded down, so
 * a change that makes one worse still fails. Catppuccin is used as published;
 * see src/themes/catppuccin.ts. So are the Prohibitorum themes: Pro Citrus's
 * primary is a yellow fill that Prohibitorum never sets as text, and
 * Pro Graphite keeps Prohibitorum's lighter sidebar ring.
 */
// On the light side "default" is Latte and "mocha-gray" is Latte Gray, which
// every Gray variant paints; on the dark side each id is its own flavour.
const EXEMPT: Record<string, Record<string, number>> = {
  primary: {
    "pro-citrus light default primary/background": 1.32,
  },
  text: {
    "catppuccin light default muted-foreground/background": 4.36,
    "catppuccin light default muted-foreground/muted": 3.19,
    "catppuccin light default success/background": 2.95,
    "catppuccin light default success/popover": 2.95,
    "catppuccin light default warning/background": 2.3,
    "catppuccin light default warning/popover": 2.3,
    "catppuccin light mocha-gray muted-foreground/background": 4.31,
    "catppuccin light mocha-gray muted-foreground/muted": 3.15,
    "catppuccin light mocha-gray success/background": 2.95,
    "catppuccin light mocha-gray success/popover": 2.95,
    "catppuccin light mocha-gray warning/background": 2.31,
    "catppuccin light mocha-gray warning/popover": 2.31,
    "catppuccin dark frappe muted-foreground/muted": 4.25,
    "catppuccin dark frappe-gray muted-foreground/muted": 4.24,
    // A file tree's status colours, and an ignored file's muted one, kept on
    // a hovered or current row's accent and in a sidebar: the colour says the
    // status on the page, and the letter says it on every surface.
    "default light default destructive/sidebar-accent": 4.37,
    "default light default success/sidebar-accent": 4.41,
    "default light default warning/sidebar-accent": 4.13,
    "picotera light default destructive/accent": 4.17,
    "picotera light default destructive/sidebar-accent": 3.75,
    "picotera light default success/accent": 4.2,
    "picotera light default success/sidebar-accent": 3.78,
    "picotera light default warning/accent": 4.3,
    "picotera light default warning/sidebar-accent": 3.87,
    "picotera dark default destructive/accent": 4.31,
    "picotera dark default destructive/sidebar-accent": 4.31,
    "vs light default destructive/sidebar-accent": 4.01,
    "vs light default success/sidebar-accent": 4,
    "vs light default warning/accent": 4.09,
    "vs light default warning/sidebar": 4.38,
    "vs light default warning/sidebar-accent": 3.63,
    "vs light default muted-foreground/sidebar-accent": 4.48,
    "vs dark default destructive/accent": 3.45,
    "vs dark default destructive/sidebar-accent": 3.45,
    "vs dark amoled destructive/accent": 4.27,
    "vs dark amoled destructive/sidebar-accent": 4.27,
    "github light default destructive/sidebar-accent": 4.27,
    "github light default success/accent": 4.4,
    "github light default success/sidebar-accent": 4.01,
    "github light default warning/accent": 4.22,
    "github light default warning/sidebar-accent": 3.85,
    "github dark default destructive/accent": 3.74,
    "github dark default destructive/sidebar-accent": 3.74,
    "github dark amoled destructive/accent": 4.1,
    "github dark amoled destructive/sidebar-accent": 4.1,
    "catppuccin light default destructive/accent": 3.51,
    "catppuccin light default destructive/sidebar": 4.46,
    "catppuccin light default destructive/sidebar-accent": 3.51,
    "catppuccin light default success/accent": 2.16,
    "catppuccin light default success/sidebar": 2.74,
    "catppuccin light default success/sidebar-accent": 2.16,
    "catppuccin light default warning/accent": 1.69,
    "catppuccin light default warning/sidebar": 2.15,
    "catppuccin light default warning/sidebar-accent": 1.69,
    "catppuccin light default muted-foreground/accent": 3.2,
    "catppuccin light default muted-foreground/sidebar": 4.06,
    "catppuccin light default muted-foreground/sidebar-accent": 3.2,
    "catppuccin light mocha-gray destructive/accent": 3.52,
    "catppuccin light mocha-gray destructive/sidebar": 4.47,
    "catppuccin light mocha-gray destructive/sidebar-accent": 3.52,
    "catppuccin light mocha-gray success/accent": 2.16,
    "catppuccin light mocha-gray success/sidebar": 2.75,
    "catppuccin light mocha-gray success/sidebar-accent": 2.16,
    "catppuccin light mocha-gray warning/accent": 1.69,
    "catppuccin light mocha-gray warning/sidebar": 2.15,
    "catppuccin light mocha-gray warning/sidebar-accent": 1.69,
    "catppuccin light mocha-gray muted-foreground/accent": 3.16,
    "catppuccin light mocha-gray muted-foreground/sidebar": 4.02,
    "catppuccin light mocha-gray muted-foreground/sidebar-accent": 3.16,
    "catppuccin dark frappe destructive/accent": 3.56,
    "catppuccin dark frappe destructive/sidebar-accent": 3.56,
    "catppuccin dark frappe muted-foreground/accent": 4.26,
    "catppuccin dark frappe muted-foreground/sidebar-accent": 4.26,
    "catppuccin dark frappe-gray destructive/accent": 3.56,
    "catppuccin dark frappe-gray destructive/sidebar-accent": 3.56,
    "catppuccin dark frappe-gray muted-foreground/accent": 4.25,
    "catppuccin dark frappe-gray muted-foreground/sidebar-accent": 4.25,
    "gruvbox light default destructive/sidebar-accent": 4.1,
    "gruvbox light default success/accent": 4.28,
    "gruvbox light default success/sidebar-accent": 3.82,
    "gruvbox light default warning/accent": 4.31,
    "gruvbox light default warning/sidebar-accent": 3.85,
    "gruvbox light default muted-foreground/sidebar-accent": 4.43,
    "gruvbox dark default destructive/accent": 3.23,
    "gruvbox dark default destructive/sidebar-accent": 3.23,
    "gruvbox dark default success/accent": 3.3,
    "gruvbox dark default success/sidebar-accent": 3.3,
    "gruvbox dark default warning/accent": 4.13,
    "gruvbox dark default warning/sidebar-accent": 4.13,
    "gruvbox dark default muted-foreground/accent": 4.14,
    "gruvbox dark default muted-foreground/sidebar-accent": 4.14,
    "gruvbox dark amoled destructive/accent": 4.23,
    "gruvbox dark amoled destructive/sidebar-accent": 4.23,
    "gruvbox dark amoled success/accent": 4.32,
    "gruvbox dark amoled success/sidebar-accent": 4.32,
    "pro-graphite light default success/sidebar-accent": 4.21,
    "pro-graphite light default warning/sidebar-accent": 3.95,
    "pro-graphite light default muted-foreground/sidebar-accent": 4.38,
    "pro-nord light default destructive/sidebar-accent": 4.33,
    "pro-nord light default success/accent": 4.17,
    "pro-nord light default success/sidebar": 4.4,
    "pro-nord light default success/sidebar-accent": 3.61,
    "pro-nord dark default destructive/accent": 4.49,
    "pro-nord dark default destructive/sidebar-accent": 4.49,
    "pro-nord dark default success/accent": 4.45,
    "pro-nord dark default success/sidebar-accent": 4.45,
    "pro-nord dark default muted-foreground/accent": 4.33,
    "pro-nord dark default muted-foreground/sidebar-accent": 4.33,
    "pro-sand light default success/accent": 4.38,
    "pro-sand light default success/sidebar-accent": 3.98,
    "pro-sand light default warning/accent": 4.1,
    "pro-sand light default warning/sidebar-accent": 3.74,
    "pro-sand light default muted-foreground/sidebar-accent": 4.49,
    "pro-matcha light default success/accent": 4.47,
    "pro-matcha light default success/sidebar-accent": 3.88,
    "pro-matcha light default warning/accent": 4.19,
    "pro-matcha light default warning/sidebar": 4.38,
    "pro-matcha light default warning/sidebar-accent": 3.64,
    "pro-matcha light default muted-foreground/sidebar-accent": 4.28,
    "pro-matcha dark default muted-foreground/accent": 4,
    "pro-matcha dark default muted-foreground/sidebar-accent": 4,
    "pro-sakura light default success/accent": 4.43,
    "pro-sakura light default success/sidebar-accent": 3.98,
    "pro-sakura light default warning/accent": 4.15,
    "pro-sakura light default warning/sidebar-accent": 3.74,
    "pro-lavender light default destructive/sidebar-accent": 4.33,
    "pro-lavender light default success/accent": 4.38,
    "pro-lavender light default success/sidebar": 4.41,
    "pro-lavender light default success/sidebar-accent": 3.62,
    "pro-lavender light default muted-foreground/sidebar-accent": 4.22,
    "pro-lavender dark default destructive/accent": 4.35,
    "pro-lavender dark default destructive/sidebar-accent": 4.35,
    "pro-lagoon light default success/accent": 4.43,
    "pro-lagoon light default success/sidebar-accent": 3.97,
    "pro-lagoon light default warning/accent": 4.16,
    "pro-lagoon light default warning/sidebar-accent": 3.72,
    "pro-lagoon light default muted-foreground/sidebar-accent": 4.38,
    "pro-citrus light default success/sidebar-accent": 4.06,
    "pro-citrus light default warning/accent": 4.37,
    "pro-citrus light default warning/sidebar-accent": 3.8,
    "dracula dark default destructive/accent": 3.76,
    "dracula dark default destructive/sidebar-accent": 3.76,
    "nord dark default destructive/accent": 3.47,
    "nord dark default destructive/sidebar-accent": 3.47,
    "nord dark default success/accent": 4.47,
    "nord dark default success/sidebar-accent": 4.47,
    "tokyo-night dark default destructive/accent": 4.11,
    "tokyo-night dark default destructive/sidebar-accent": 4.11,
    "tokyo-night dark default muted-foreground/accent": 4.43,
    "tokyo-night dark default muted-foreground/sidebar-accent": 4.43,
    "one-dark dark default destructive/accent": 3.65,
    "one-dark dark default destructive/sidebar-accent": 3.65,
    "one-dark dark default warning/accent": 3.85,
    "one-dark dark default warning/sidebar-accent": 3.85,
    "one-dark dark default muted-foreground/accent": 4.36,
    "one-dark dark default muted-foreground/sidebar-accent": 4.36,
    "monokai dark default destructive/accent": 3.14,
    "monokai dark default destructive/sidebar-accent": 3.14,
    "monokai dark default success/accent": 4.22,
    "monokai dark default success/sidebar-accent": 4.22,
    "monokai dark default muted-foreground/accent": 4.47,
    "monokai dark default muted-foreground/sidebar-accent": 4.47,
    "monokai dark amoled destructive/accent": 4.02,
    "monokai dark amoled destructive/sidebar-accent": 4.02,
    "afterglow dark default destructive/accent": 3.85,
    "afterglow dark default destructive/sidebar-accent": 3.85,
    "afterglow dark default muted-foreground/accent": 4.43,
    "afterglow dark default muted-foreground/sidebar-accent": 4.43,
  },
  field: {
    "catppuccin light default input/background": 2.29,
    "catppuccin light default input/card": 2.29,
    "catppuccin light default input/popover": 2.29,
    "catppuccin light mocha-gray input/background": 2.28,
    "catppuccin light mocha-gray input/card": 2.28,
    "catppuccin light mocha-gray input/popover": 2.28,
    "catppuccin dark frappe input/background": 2.86,
    "catppuccin dark frappe input/card": 2.86,
    "catppuccin dark frappe input/popover": 2.86,
    "catppuccin dark frappe-gray input/background": 2.85,
    "catppuccin dark frappe-gray input/card": 2.85,
    "catppuccin dark frappe-gray input/popover": 2.85,
  },
  focus: {
    "catppuccin light default ring/background": 2.8,
    "catppuccin light default ring/card": 2.8,
    "catppuccin light default ring/popover": 2.8,
    "catppuccin light default ring/muted": 2.05,
    "catppuccin light default sidebar-ring/sidebar": 2.61,
    "catppuccin light mocha-gray ring/background": 2.81,
    "catppuccin light mocha-gray ring/card": 2.81,
    "catppuccin light mocha-gray ring/popover": 2.81,
    "catppuccin light mocha-gray ring/muted": 2.05,
    "catppuccin light mocha-gray sidebar-ring/sidebar": 2.61,
    "pro-graphite light default sidebar-ring/sidebar": 2.47,
  },
  state: {
    "pro-citrus light default primary/background": 1.32,
  },
  chart: {
    "catppuccin light default chart-2/background": 2.95,
    "catppuccin light default chart-3/background": 2.3,
    "catppuccin light mocha-gray chart-2/background": 2.95,
    "catppuccin light mocha-gray chart-3/background": 2.31,
    "pro-citrus light default chart-1/background": 1.32,
  },
};

/**
 * The rows under `floor`, or under their own exemption, and every exemption
 * of `test` that no longer names a row under `floor`, so the list cannot go
 * stale.
 */
export function failures(
  test: string,
  rows: { name: string; ratio: number }[],
  floor: number,
): string[] {
  const exempt = EXEMPT[test] ?? {};
  const below = rows
    .filter((r) => r.ratio < (exempt[r.name] ?? floor))
    .map((r) => `${r.name} ${r.ratio.toFixed(2)}:1`);
  const stale = Object.keys(exempt)
    .filter((name) => !rows.some((r) => r.name === name && r.ratio < floor))
    .map((name) => `stale exemption: ${name}`);
  return [...below, ...stale];
}
