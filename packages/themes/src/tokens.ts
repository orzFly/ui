import type { TerminalTokenName, TokenName } from "./types.ts";

/** UI names in `@orz/ui` styles.css `:root` order; renderDeclarations emits in this order. */
export const TOKEN_NAMES: readonly TokenName[] = [
  "diff-addition",
  "diff-deletion",
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "success",
  "warning",
  "border",
  "input",
  "ring",
  "marker",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
];

/**
 * UI names added after custom themes could be saved. A fully custom side or
 * theme file written before them lacks them; composeTheme fills them in.
 */
export const LATE_TOKEN_NAMES: readonly TokenName[] = [
  "success",
  "warning",
  "marker",
];

/** Terminal names; renderTerminalDeclarations emits in this order. */
export const TERMINAL_TOKEN_NAMES: readonly TerminalTokenName[] = [
  "terminal-background",
  "terminal-foreground",
  "terminal-cursor",
  "terminal-selection",
  "ansi-black",
  "ansi-red",
  "ansi-green",
  "ansi-yellow",
  "ansi-blue",
  "ansi-magenta",
  "ansi-cyan",
  "ansi-white",
  "ansi-bright-black",
  "ansi-bright-red",
  "ansi-bright-green",
  "ansi-bright-yellow",
  "ansi-bright-blue",
  "ansi-bright-magenta",
  "ansi-bright-cyan",
  "ansi-bright-white",
];

export const DEFAULT_VARIANT = "default";
