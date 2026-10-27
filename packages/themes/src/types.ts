export type ColorScheme = "light" | "dark";

/** The 35 UI custom properties, named as in CSS without the leading `--`. */
export type TokenName =
  | "background"
  | "foreground"
  | "card"
  | "card-foreground"
  | "popover"
  | "popover-foreground"
  | "primary"
  | "primary-foreground"
  | "secondary"
  | "secondary-foreground"
  | "muted"
  | "muted-foreground"
  | "accent"
  | "accent-foreground"
  | "destructive"
  | "success"
  | "warning"
  | "border"
  | "input"
  | "ring"
  | "chart-1"
  | "chart-2"
  | "chart-3"
  | "chart-4"
  | "chart-5"
  | "sidebar"
  | "sidebar-foreground"
  | "sidebar-primary"
  | "sidebar-primary-foreground"
  | "sidebar-accent"
  | "sidebar-accent-foreground"
  | "sidebar-border"
  | "sidebar-ring"
  | "diff-addition"
  | "diff-deletion";
export type Tokens = Record<TokenName, string>;

/** The 20 terminal custom properties: the terminal's own surface, cursor and selection, and the 16 ANSI colours. */
export type TerminalTokenName =
  | "terminal-background"
  | "terminal-foreground"
  | "terminal-cursor"
  | "terminal-selection"
  | "ansi-black"
  | "ansi-red"
  | "ansi-green"
  | "ansi-yellow"
  | "ansi-blue"
  | "ansi-magenta"
  | "ansi-cyan"
  | "ansi-white"
  | "ansi-bright-black"
  | "ansi-bright-red"
  | "ansi-bright-green"
  | "ansi-bright-yellow"
  | "ansi-bright-blue"
  | "ansi-bright-magenta"
  | "ansi-bright-cyan"
  | "ansi-bright-white";
export type TerminalTokens = Record<TerminalTokenName, string>;

export interface TerminalVariant {
  label: string;
  terminal?: Partial<TerminalTokens>;
}
export interface Variant extends TerminalVariant {
  /** Overrides on top of the palette's UI tokens. */
  tokens?: Partial<Tokens>;
  /** Overrides the palette's syntax theme. */
  syntax?: string;
}

export interface TerminalPalette {
  /** "Latte", "Mocha", "Pico"; a picker shows it after the theme label. */
  label?: string;
  terminal: TerminalTokens;
  /** Keyed by variant id. "default" is reserved: it names the palette itself. */
  variants?: Record<string, TerminalVariant>;
}
export interface Palette extends TerminalPalette {
  tokens: Tokens;
  /** shiki theme from pierre's bundled collection; absent = pierre's own tokens. */
  syntax?: string;
  variants?: Record<string, Variant>;
}

export type TerminalTheme = { id: string; label: string } & (
  | { light: TerminalPalette; dark?: TerminalPalette }
  | { light?: TerminalPalette; dark: TerminalPalette }
);
export type Theme = { id: string; label: string } & (
  | { light: Palette; dark?: Palette }
  | { light?: Palette; dark: Palette }
);

export type CustomTerminal =
  | {
      base: { theme: string; scheme?: ColorScheme; variant?: string };
      tokens?: Partial<TerminalTokens>;
    }
  | { tokens: TerminalTokens };
export type CustomSide =
  | {
      base: { theme: string; variant?: string };
      tokens?: Partial<Tokens>;
      terminal?: CustomTerminal;
    }
  | { tokens: Tokens; terminal: CustomTerminal };
export type CustomTheme = {
  id: string;
  /** Absent in everything written before terminal custom themes existed; writers omit it. */
  kind?: "ui";
  label: string;
  light?: CustomSide;
  dark?: CustomSide;
};
/** A custom theme made of terminal colours alone; composes into a `TerminalTheme`. */
export type CustomTerminalTheme = {
  id: string;
  kind: "terminal";
  label: string;
  light?: CustomTerminal;
  dark?: CustomTerminal;
};
/** What a store's custom list holds. */
export type AnyCustomTheme = CustomTheme | CustomTerminalTheme;

export interface ResolvedPalette {
  tokens: Tokens;
  terminal: TerminalTokens;
  syntax?: string;
  /** The variant actually applied on this side: the requested id, or "default". */
  variant: string;
}
export interface ResolvedTerminal {
  terminal: TerminalTokens;
  variant: string;
}
