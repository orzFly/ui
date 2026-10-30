export type ColorScheme = "light" | "dark";

/** The 36 UI custom properties, named as in CSS without the leading `--`. */
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
  | "marker"
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

/**
 * A TextMate theme as shiki reads it, cut down to what a palette's own theme
 * sets. Plain data, so a theme stays JSON and this package needs no shiki.
 */
export interface TextMateTheme {
  /** The highlighter registers it under this name, which no bundled theme has. */
  name: string;
  type: ColorScheme;
  colors: { "editor.foreground": string; "editor.background": string };
  tokenColors: {
    scope: string[];
    settings: { foreground: string; fontStyle?: string };
  }[];
}

/** The chromatic roles a palette's own syntax theme is drawn from. */
export interface SyntaxRoles {
  keyword: string;
  string: string;
  /** Numbers, booleans, `null` and named constants. */
  constant: string;
  function: string;
  type: string;
  property: string;
  parameter: string;
}

export interface TerminalVariant {
  label: string;
  terminal?: Partial<TerminalTokens>;
}
export interface Variant extends TerminalVariant {
  /** Overrides on top of the palette's UI tokens. */
  tokens?: Partial<Tokens>;
  /** Overrides the palette's syntax theme. */
  syntax?: string | TextMateTheme;
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
  /**
   * The colour tokens the theme's styles add beyond the 36 (each `Style`'s `tokens`), named as in
   * CSS without the leading `--`.
   */
  styleTokens?: Record<string, string>;
  /**
   * A shiki theme from pierre's bundled collection, by name, or a theme drawn
   * for this palette; absent = pierre's own tokens.
   */
  syntax?: string | TextMateTheme;
  variants?: Record<string, Variant>;
}

interface ThemeHead {
  id: string;
  label: string;
  /** What a picker calls the `default` variant; "Default" when absent. */
  defaultVariantLabel?: string;
}

export type TerminalTheme = ThemeHead &
  (
    | { light: TerminalPalette; dark?: TerminalPalette }
    | { light?: TerminalPalette; dark: TerminalPalette }
  );
export type Theme = ThemeHead & {
  /** The ids of the styles the theme belongs to; absent = `["default"]`. */
  styles?: readonly string[];
} & ({ light: Palette; dark?: Palette } | { light?: Palette; dark: Palette });

/**
 * How components are drawn: radii, edges, depth, type, density, focus, state cues and motion.
 * Plain data; what it changes is a stylesheet scoped to `[data-style="<id>"]`.
 */
export interface Style {
  id: string;
  label: string;
  /** Colour tokens beyond the 36 that a palette of this style supplies in `styleTokens`. */
  tokens?: readonly string[];
}

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
  /**
   * The style a fully custom side belongs to, recorded when the theme is made; absent =
   * "default". A based side belongs to its base theme's styles instead.
   */
  style?: string;
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
  styleTokens?: Record<string, string>;
  terminal: TerminalTokens;
  syntax?: string | TextMateTheme;
  /** The variant actually applied on this side: the requested id, or "default". */
  variant: string;
}
export interface ResolvedTerminal {
  terminal: TerminalTokens;
  variant: string;
}
