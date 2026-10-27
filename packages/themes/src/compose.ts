import { isUiTheme, resolvePalette, resolveTerminal } from "./resolve.ts";
import type {
  AnyCustomTheme,
  ColorScheme,
  CustomSide,
  CustomTerminal,
  CustomTerminalTheme,
  CustomTheme,
  Palette,
  TerminalPalette,
  TerminalTheme,
  TerminalTokens,
  Theme,
  Tokens,
} from "./types.ts";

/**
 * A fully custom side's tokens, each of `LATE_TOKEN_NAMES` it was saved
 * without taken from the nearest colour it already has, so it keeps its hues.
 * The type says complete; a side stored before them is not.
 */
function withLateTokens(tokens: Tokens, terminal: TerminalTokens): Tokens {
  return {
    ...tokens,
    success: tokens.success ?? tokens["diff-addition"],
    warning: tokens.warning ?? terminal["ansi-yellow"],
  };
}

function resolveCustomTerminal(
  custom: CustomTerminal,
  scheme: ColorScheme,
  themes: readonly TerminalTheme[],
): TerminalTokens | null {
  if (!("base" in custom)) return { ...custom.tokens };
  const base = themes.find((t) => t.id === custom.base.theme);
  if (base === undefined) return null;
  // A one-palette base serves either side, so a dark-only terminal can sit
  // under a light UI side without naming the scheme.
  const own = base.light ? (base.dark ? scheme : "light") : "dark";
  const resolved = resolveTerminal(
    base,
    custom.base.scheme ?? own,
    custom.base.variant,
  );
  if (resolved === null) return null;
  return { ...resolved.terminal, ...custom.tokens };
}

function composeSide(
  side: CustomSide,
  scheme: ColorScheme,
  themes: readonly TerminalTheme[],
): Palette | null {
  if (!("base" in side)) {
    const terminal = resolveCustomTerminal(side.terminal, scheme, themes);
    if (terminal === null) return null;
    return { tokens: withLateTokens(side.tokens, terminal), terminal };
  }
  const base = themes.find((t) => t.id === side.base.theme);
  if (base === undefined || !isUiTheme(base)) return null;
  const resolved = resolvePalette(base, scheme, side.base.variant);
  if (resolved === null) return null;
  const terminal =
    (side.terminal && resolveCustomTerminal(side.terminal, scheme, themes)) ??
    resolved.terminal;
  const palette: Palette = {
    tokens: { ...resolved.tokens, ...side.tokens },
    terminal,
  };
  if (resolved.syntax !== undefined) palette.syntax = resolved.syntax;
  return palette;
}

/**
 * A custom theme made into an ordinary `Theme` against the current lists.
 * `themes` may include terminal-only themes, used only as terminal bases.
 * null when no side survives, and the caller leaves the theme out.
 */
export function composeTheme(
  custom: CustomTheme,
  themes: readonly TerminalTheme[],
): Theme | null {
  const light = custom.light && composeSide(custom.light, "light", themes);
  const dark = custom.dark && composeSide(custom.dark, "dark", themes);
  if (!light && !dark) return null;
  const theme: { id: string; label: string; light?: Palette; dark?: Palette } =
    { id: custom.id, label: custom.label };
  if (light) theme.light = light;
  if (dark) theme.dark = dark;
  return theme as Theme;
}

export function isCustomTerminalTheme(
  custom: AnyCustomTheme,
): custom is CustomTerminalTheme {
  return custom.kind === "terminal";
}

/**
 * A terminal custom theme made into an ordinary `TerminalTheme`, each side
 * resolved as a UI side's terminal is. null when no side survives.
 */
export function composeTerminalTheme(
  custom: CustomTerminalTheme,
  themes: readonly TerminalTheme[],
): TerminalTheme | null {
  const light =
    custom.light && resolveCustomTerminal(custom.light, "light", themes);
  const dark =
    custom.dark && resolveCustomTerminal(custom.dark, "dark", themes);
  if (!light && !dark) return null;
  const theme: {
    id: string;
    label: string;
    light?: TerminalPalette;
    dark?: TerminalPalette;
  } = { id: custom.id, label: custom.label };
  if (light) theme.light = { terminal: light };
  if (dark) theme.dark = { terminal: dark };
  return theme as TerminalTheme;
}
