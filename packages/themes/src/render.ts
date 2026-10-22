import { TERMINAL_TOKEN_NAMES, TOKEN_NAMES } from "./tokens.ts";
import type { ColorScheme, TerminalTokens, Tokens } from "./types.ts";

/** "color-scheme: dark; --background: oklch(…); …" — UI tokens only; no selector, no braces. */
export function renderDeclarations(
  tokens: Tokens,
  scheme: ColorScheme,
): string {
  return [
    `color-scheme: ${scheme};`,
    ...TOKEN_NAMES.map((name) => `--${name}: ${tokens[name]};`),
  ].join(" ");
}

/** "--terminal-background: #…; …; --ansi-bright-white: #…;" */
export function renderTerminalDeclarations(terminal: TerminalTokens): string {
  return TERMINAL_TOKEN_NAMES.map(
    (name) => `--${name}: ${terminal[name]};`,
  ).join(" ");
}
