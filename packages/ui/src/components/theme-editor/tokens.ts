import type { TerminalTokenName, TokenName } from "@orz/themes";

export interface TokenEntry<N extends string> {
  name: N;
  label: string;
}

/**
 * `pair`: a surface and the text drawn on it, sharing a row with an "Aa"
 * sample. `strip`: swatches side by side (the five charts, one ANSI row).
 */
export type TokenRow<N extends string> =
  | { kind: "pair"; surface: TokenEntry<N>; text: TokenEntry<N> }
  | { kind: "single"; token: TokenEntry<N> }
  | { kind: "strip"; tokens: TokenEntry<N>[] };

export interface TokenGroup<N extends string> {
  id: string;
  label: string;
  rows: TokenRow<N>[];
}

const pair = <N extends string>(
  surface: N,
  surfaceLabel: string,
  text: N,
  textLabel: string,
): TokenRow<N> => ({
  kind: "pair",
  surface: { name: surface, label: surfaceLabel },
  text: { name: text, label: textLabel },
});

const single = <N extends string>(name: N, label: string): TokenRow<N> => ({
  kind: "single",
  token: { name, label },
});

const ANSI = [
  ["black", "Black"],
  ["red", "Red"],
  ["green", "Green"],
  ["yellow", "Yellow"],
  ["blue", "Blue"],
  ["magenta", "Magenta"],
  ["cyan", "Cyan"],
  ["white", "White"],
] as const;

export const UI_TOKEN_GROUPS: readonly TokenGroup<TokenName>[] = [
  {
    id: "surfaces",
    label: "Surfaces",
    rows: [
      pair("background", "Background", "foreground", "Text"),
      pair("card", "Card", "card-foreground", "Card text"),
      pair("popover", "Popover", "popover-foreground", "Popover text"),
    ],
  },
  {
    id: "actions",
    label: "Actions",
    rows: [
      pair("primary", "Primary", "primary-foreground", "On primary"),
      pair("secondary", "Secondary", "secondary-foreground", "On secondary"),
      pair("accent", "Accent", "accent-foreground", "On accent"),
      pair("muted", "Muted", "muted-foreground", "Muted text"),
      single("destructive", "Destructive"),
    ],
  },
  {
    id: "lines",
    label: "Lines & focus",
    rows: [
      single("border", "Border"),
      single("input", "Input border"),
      single("ring", "Focus ring"),
    ],
  },
  {
    id: "charts",
    label: "Charts",
    rows: [
      {
        kind: "strip",
        tokens: ([1, 2, 3, 4, 5] as const).map((n) => ({
          name: `chart-${n}` as const,
          label: `Chart ${n}`,
        })),
      },
    ],
  },
  {
    id: "sidebar",
    label: "Sidebar",
    rows: [
      pair("sidebar", "Sidebar", "sidebar-foreground", "Sidebar text"),
      pair(
        "sidebar-primary",
        "Sidebar primary",
        "sidebar-primary-foreground",
        "On sidebar primary",
      ),
      pair(
        "sidebar-accent",
        "Sidebar accent",
        "sidebar-accent-foreground",
        "On sidebar accent",
      ),
      single("sidebar-border", "Sidebar border"),
      single("sidebar-ring", "Sidebar focus ring"),
    ],
  },
  {
    id: "diff",
    label: "Diff",
    rows: [
      single("diff-addition", "Addition"),
      single("diff-deletion", "Deletion"),
    ],
  },
];

export const TERMINAL_TOKEN_GROUPS: readonly TokenGroup<TerminalTokenName>[] = [
  {
    id: "terminal-text",
    label: "Background & text",
    rows: [
      pair("terminal-background", "Background", "terminal-foreground", "Text"),
    ],
  },
  {
    id: "ansi",
    label: "ANSI colours",
    rows: [
      {
        kind: "strip",
        tokens: ANSI.map(([id, label]) => ({
          name: `ansi-${id}` as const,
          label,
        })),
      },
      {
        kind: "strip",
        tokens: ANSI.map(([id, label]) => ({
          name: `ansi-bright-${id}` as const,
          label,
        })),
      },
    ],
  },
  {
    id: "cursor",
    label: "Cursor & selection",
    rows: [
      single("terminal-cursor", "Cursor"),
      single("terminal-selection", "Selection"),
    ],
  },
];

/** The token names a row or group holds, in display order. */
export function rowTokens<N extends string>(row: TokenRow<N>): TokenEntry<N>[] {
  if (row.kind === "pair") return [row.surface, row.text];
  if (row.kind === "single") return [row.token];
  return row.tokens;
}

export function groupTokens<N extends string>(group: TokenGroup<N>): N[] {
  return group.rows.flatMap((row) => rowTokens(row).map((t) => t.name));
}

/**
 * The surface a single token is drawn on, for its popover's contrast ratio.
 * Pair members are absent: their row shows the pair's ratio.
 */
export const UI_CONTRAST_WITH: Readonly<Partial<Record<TokenName, TokenName>>> =
  {
    destructive: "background",
    border: "background",
    input: "background",
    ring: "background",
    "chart-1": "background",
    "chart-2": "background",
    "chart-3": "background",
    "chart-4": "background",
    "chart-5": "background",
    "diff-addition": "background",
    "diff-deletion": "background",
    "sidebar-border": "sidebar",
    "sidebar-ring": "sidebar",
  };

export const TERMINAL_CONTRAST_WITH: Readonly<
  Partial<Record<TerminalTokenName, TerminalTokenName>>
> = Object.fromEntries(
  [
    ...ANSI.flatMap(([id]) => [`ansi-${id}`, `ansi-bright-${id}`]),
    "terminal-cursor",
    "terminal-selection",
  ].map((name) => [name, "terminal-background"]),
);
