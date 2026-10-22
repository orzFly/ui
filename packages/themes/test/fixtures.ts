import {
  TERMINAL_TOKEN_NAMES,
  type TerminalTheme,
  type TerminalTokens,
  type Theme,
  TOKEN_NAMES,
  type Tokens,
} from "../src/index.ts";

/** Every UI token set to `oklch(l 0 0)`, then the overrides. */
export function tokens(l: number, overrides: Partial<Tokens> = {}): Tokens {
  return {
    ...(Object.fromEntries(
      TOKEN_NAMES.map((name) => [name, `oklch(${l} 0 0)`]),
    ) as Tokens),
    ...overrides,
  };
}

/** Every terminal token set to `hex`, then the overrides. */
export function terminal(
  hex: string,
  overrides: Partial<TerminalTokens> = {},
): TerminalTokens {
  return {
    ...(Object.fromEntries(
      TERMINAL_TOKEN_NAMES.map((name) => [name, hex]),
    ) as TerminalTokens),
    ...overrides,
  };
}

/** Two palettes; `dim` only on dark, `soft` on both. */
export const duo: Theme = {
  id: "duo",
  label: "Duo",
  light: {
    label: "Day",
    tokens: tokens(0.9),
    terminal: terminal("#eeeeee"),
    syntax: "duo-light",
    variants: {
      soft: {
        label: "Soft",
        tokens: { background: "oklch(0.8 0 0)" },
        syntax: "duo-soft",
      },
    },
  },
  dark: {
    tokens: tokens(0.2),
    terminal: terminal("#222222"),
    syntax: "duo-dark",
    variants: {
      dim: {
        label: "Dim",
        tokens: { foreground: "oklch(0.6 0 0)" },
        terminal: { "ansi-red": "#880000" },
      },
      soft: { label: "Soft", tokens: { background: "oklch(0.3 0 0)" } },
    },
  },
};

/** Dark only, no syntax. */
export const night: Theme = {
  id: "night",
  label: "Night",
  dark: { tokens: tokens(0.1), terminal: terminal("#111111") },
};

/** A terminal-only theme, on both sides. */
export const term: TerminalTheme = {
  id: "term",
  label: "Term",
  light: { terminal: terminal("#fafafa") },
  dark: {
    terminal: terminal("#0a0a0a"),
    variants: {
      hc: { label: "High contrast", terminal: { "ansi-red": "#ff0000" } },
    },
  },
};

/** A terminal-only theme with only a dark side. */
export const ink: TerminalTheme = {
  id: "ink",
  label: "Ink",
  dark: { terminal: terminal("#050505") },
};
