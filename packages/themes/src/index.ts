export { amoled } from "./amoled.ts";
export { composeTheme } from "./compose.ts";
export { renderDeclarations, renderTerminalDeclarations } from "./render.ts";
export {
  isUiTheme,
  resolvePalette,
  resolveTerminal,
  schemesOf,
  variantsOf,
} from "./resolve.ts";
export {
  DEFAULT_VARIANT,
  TERMINAL_TOKEN_NAMES,
  TOKEN_NAMES,
} from "./tokens.ts";
export type {
  ColorScheme,
  CustomSide,
  CustomTerminal,
  CustomTheme,
  Palette,
  ResolvedPalette,
  ResolvedTerminal,
  TerminalPalette,
  TerminalTheme,
  TerminalTokenName,
  TerminalTokens,
  TerminalVariant,
  Theme,
  TokenName,
  Tokens,
  Variant,
} from "./types.ts";
export { xtermTheme } from "./xterm.ts";
