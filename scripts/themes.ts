// The built-in themes as rows of a table, for the themes README and the docs site, so neither
// lists a theme, a side or a variant by hand.
import * as themes from "../packages/themes/src/index.ts";
import type { Palette, Theme } from "../packages/themes/src/types.ts";

export interface ThemeRow {
  label: string;
  id: string;
  /** The export that holds it, as an app imports it. */
  name: string;
  /** The side's own name ("Latte") or "✓", then its variants; null for a side the theme lacks. */
  light: string | null;
  dark: string | null;
}

export interface ThemeTable {
  rows: ThemeRow[];
  /** Every dark palette has an `amoled` variant, so the rows leave it out. */
  amoledEverywhere: boolean;
}

const AMOLED = "amoled";

function exportName(theme: Theme): string {
  const found = Object.entries(themes).find(([, value]) => value === theme);
  if (!found) throw new Error(`${theme.id}: not exported from @orz/themes`);
  return found[0];
}

function side(palette: Palette | undefined, skip: string[]): string | null {
  if (!palette) return null;
  const variants = Object.entries(palette.variants ?? {})
    .filter(([id]) => !skip.includes(id))
    .map(([, { label }]) => label);
  const own = palette.label ?? "✓";
  return variants.length > 0 ? `${own}; ${variants.join(", ")}` : own;
}

export function themeTable(
  builtin: readonly Theme[] = themes.builtinThemes,
): ThemeTable {
  const amoledEverywhere = builtin.every(
    (theme) => !theme.dark || theme.dark.variants?.[AMOLED] !== undefined,
  );
  const skip = amoledEverywhere ? [AMOLED] : [];
  return {
    amoledEverywhere,
    rows: builtin.map((theme) => ({
      label: theme.label,
      id: theme.id,
      name: exportName(theme),
      light: side(theme.light, skip),
      dark: side(theme.dark, skip),
    })),
  };
}

/** The table as the README has it. */
export function themeMarkdown({ rows, amoledEverywhere }: ThemeTable): string {
  const lines = [
    "| Theme | Import | Light | Dark |",
    "|---|---|---|---|",
    ...rows.map(({ label, id, name, light, dark }) => {
      const code = name === id ? `\`${name}\`` : `\`${name}\` (\`${id}\`)`;
      return `| ${label} | ${code} | ${light ?? ""} | ${dark ?? ""} |`;
    }),
  ];
  if (amoledEverywhere) {
    lines.push("", "Every dark palette also has an `amoled` variant.");
  }
  return lines.join("\n");
}
