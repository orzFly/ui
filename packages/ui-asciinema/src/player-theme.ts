import { formatColor, parseColor } from "@orz/ui/lib/color";
import type { TerminalTokenName, TerminalTokens } from "@orz/ui/theme";

/** The player's `--term-color-0`…`15`: normal 0–7, then bright 8–15, as `xtermTheme` orders them. */
export const ANSI_ORDER = [
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
] as const satisfies readonly TerminalTokenName[];

// The player accepts only #rgb / #rrggbb and silently falls back on anything
// else, so an oklch custom theme would come out in its default colours.
function hex(token: string): string | undefined {
  const parsed = parseColor(token);
  return parsed === null
    ? undefined
    : formatColor(parsed.color, "hex", { alpha: false });
}

/**
 * Terminal tokens as asciinema-player's custom properties, each `#rrggbb`. A token that does not
 * parse is left out, so the player keeps its own default for that colour. The cursor and
 * selection tokens have no counterpart in the player.
 */
export function playerThemeVars(
  tokens: TerminalTokens,
): Record<string, string> {
  const vars: Record<string, string> = {};
  const put = (name: string, token: string) => {
    const value = hex(token);
    if (value !== undefined) vars[name] = value;
  };
  put("--term-color-foreground", tokens["terminal-foreground"]);
  put("--term-color-background", tokens["terminal-background"]);
  ANSI_ORDER.forEach((name, index) => {
    put(`--term-color-${index}`, tokens[name]);
  });
  return vars;
}
