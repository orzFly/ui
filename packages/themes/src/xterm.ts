import type { TerminalTokens } from "./types.ts";

/**
 * Terminal tokens under xterm.js's `ITheme` field names, for
 * `terminal.options.theme`. A plain mapping, so this package needs no xterm.js.
 */
export function xtermTheme(terminal: TerminalTokens): {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
} {
  return {
    background: terminal["terminal-background"],
    foreground: terminal["terminal-foreground"],
    cursor: terminal["terminal-cursor"],
    // The glyph under a block cursor, so it reads as cut out of the cursor.
    cursorAccent: terminal["terminal-background"],
    selectionBackground: terminal["terminal-selection"],
    black: terminal["ansi-black"],
    red: terminal["ansi-red"],
    green: terminal["ansi-green"],
    yellow: terminal["ansi-yellow"],
    blue: terminal["ansi-blue"],
    magenta: terminal["ansi-magenta"],
    cyan: terminal["ansi-cyan"],
    white: terminal["ansi-white"],
    brightBlack: terminal["ansi-bright-black"],
    brightRed: terminal["ansi-bright-red"],
    brightGreen: terminal["ansi-bright-green"],
    brightYellow: terminal["ansi-bright-yellow"],
    brightBlue: terminal["ansi-bright-blue"],
    brightMagenta: terminal["ansi-bright-magenta"],
    brightCyan: terminal["ansi-bright-cyan"],
    brightWhite: terminal["ansi-bright-white"],
  };
}
