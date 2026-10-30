import { TERMINAL_TOKEN_NAMES, TOKEN_NAMES } from "./tokens.ts";
import type { ColorScheme, TerminalTokens, Tokens } from "./types.ts";

/**
 * "color-scheme: dark; --background: oklch(…); …" — UI tokens, then the palette's style tokens in
 * their own order; no selector, no braces.
 */
export function renderDeclarations(
  tokens: Tokens,
  scheme: ColorScheme,
  styleTokens?: Readonly<Record<string, string>>,
): string {
  return [
    `color-scheme: ${scheme};`,
    ...TOKEN_NAMES.map((name) => `--${name}: ${tokens[name]};`),
    ...Object.entries(styleTokens ?? {}).map(
      ([name, value]) => `--${name}: ${value};`,
    ),
  ].join(" ");
}

/** "--terminal-background: #…; …; --ansi-bright-white: #…;" */
export function renderTerminalDeclarations(terminal: TerminalTokens): string {
  return TERMINAL_TOKEN_NAMES.map(
    (name) => `--${name}: ${terminal[name]};`,
  ).join(" ");
}
