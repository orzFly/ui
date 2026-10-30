import {
  builtinThemes,
  resolvePalette,
  schemesOf,
  type Tokens,
  variantsOf,
} from "../src/index.ts";

/**
 * Every palette under every variant the theme offers; a variant a side lacks
 * resolves to that side's default, which is what the page shows. A variant
 * that paints a side exactly as an earlier one does is listed once, under the
 * earlier name, so an exemption names each painted palette once.
 */
export const resolvedPalettes: { name: string; tokens: Tokens }[] =
  builtinThemes.flatMap((theme) =>
    schemesOf(theme).flatMap((scheme) => {
      const seen = new Set<string>();
      return variantsOf(theme).flatMap(({ id }) => {
        // biome-ignore lint/style/noNonNullAssertion: schemesOf lists only present sides
        const { tokens } = resolvePalette(theme, scheme, id)!;
        const key = JSON.stringify(tokens);
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ name: `${theme.id} ${scheme} ${id}`, tokens }];
      });
    }),
  );

/**
 * Pairs kept below a test's floor on purpose, by test and row name, each
 * holding the lowest ratio it may fall to: the palette's own, rounded down, so
 * a change that makes one worse still fails. Catppuccin is used as published;
 * see src/themes/catppuccin.ts. So are the Prohibitorum themes: ProCitrus's
 * primary is a yellow fill that Prohibitorum never sets as text, and
 * ProGraphite keeps Prohibitorum's lighter sidebar ring.
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
