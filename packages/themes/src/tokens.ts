import { TAG_COLORS, type TagTokenName } from "./tag.ts";
import type { TerminalTokenName, TokenName } from "./types.ts";

const TAG_TOKEN_NAMES: readonly TagTokenName[] = TAG_COLORS.map(
  (color) => `tag-${color}` as const,
);

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
  "selection",
  "selection-foreground",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  ...TAG_TOKEN_NAMES,
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
  "selection",
  "selection-foreground",
  ...TAG_TOKEN_NAMES,
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
