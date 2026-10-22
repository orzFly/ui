import {
  type AnyCustomTheme,
  type ColorScheme,
  type CustomSide,
  type CustomTerminal,
  type CustomTerminalTheme,
  type CustomTheme,
  composeTheme,
  DEFAULT_VARIANT,
  isCustomTerminalTheme,
  isUiTheme,
  resolveTerminal,
  TERMINAL_TOKEN_NAMES,
  type TerminalTheme,
  type TerminalTokenName,
  type TerminalTokens,
  TOKEN_NAMES,
  type TokenName,
  type Tokens,
} from "@orz/themes";
import { parseColor } from "./color.ts";

export const THEME_FILE_FORMAT = "orz-themes";
export const THEME_FILE_VERSION = 1;
/** Text longer than this many characters is refused before parsing; the import panel also checks `File.size` against it before reading a file. */
export const THEME_FILE_MAX_LENGTH = 1_000_000;

interface ThemeFile {
  format: typeof THEME_FILE_FORMAT;
  version: typeof THEME_FILE_VERSION;
  /** Always written, empty when there are no UI themes. */
  themes: FileTheme[];
  // A second array rather than a kind on entries: a reader that predates
  // terminal themes ignores an unknown key, but would read a based terminal
  // entry as a based UI side.
  /** Written only when non-empty. */
  terminalThemes?: FileTerminalTheme[];
}
interface FileTerminalTheme {
  label: string;
  light?: FileTerminal;
  dark?: FileTerminal;
}
interface FileTheme {
  label: string;
  light?: FileSide;
  dark?: FileSide;
}
type FileSide =
  | {
      base: { theme: string; variant?: string };
      tokens?: Partial<Tokens>;
      terminal?: FileTerminal;
      resolved?: { tokens: Tokens; terminal: TerminalTokens };
    }
  | { tokens: Tokens; terminal: FileTerminal };
type FileTerminal =
  | {
      base: { theme: string; scheme?: ColorScheme; variant?: string };
      tokens?: Partial<TerminalTokens>;
      resolved?: TerminalTokens;
    }
  | { tokens: TerminalTokens };

const SCHEMES: readonly ColorScheme[] = ["light", "dark"];
const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;

// The scheme composeTheme reads a terminal base at: a one-palette base serves either side.
function terminalScheme(
  base: TerminalTheme,
  explicit: ColorScheme | undefined,
  side: ColorScheme,
): ColorScheme {
  return explicit ?? (base.light ? (base.dark ? side : "light") : "dark");
}

/**
 * The file for `customs` of both kinds, each in its kind's array, pretty-printed with two-space
 * indent and a trailing newline. Ids and kinds are left out; every based side and based terminal
 * carries `resolved`, computed against `themes` (UI and terminal-only lists together). A custom
 * theme that composes to `null` is written without snapshots for the sides that cannot resolve.
 */
export function serializeThemeFile(
  customs: readonly AnyCustomTheme[],
  themes: readonly TerminalTheme[],
): string {
  const file: ThemeFile = {
    format: THEME_FILE_FORMAT,
    version: THEME_FILE_VERSION,
    themes: [],
  };
  const terminalThemes: FileTerminalTheme[] = [];
  for (const custom of customs) {
    if (isCustomTerminalTheme(custom)) {
      const out: FileTerminalTheme = { label: custom.label };
      for (const scheme of SCHEMES) {
        const side = custom[scheme];
        if (side) out[scheme] = serializeTerminal(side, scheme, themes);
      }
      terminalThemes.push(out);
      continue;
    }
    const out: FileTheme = { label: custom.label };
    for (const scheme of SCHEMES) {
      const side = custom[scheme];
      if (side) out[scheme] = serializeSide(custom, scheme, side, themes);
    }
    file.themes.push(out);
  }
  if (terminalThemes.length > 0) file.terminalThemes = terminalThemes;
  return `${JSON.stringify(file, null, 2)}\n`;
}

function serializeSide(
  custom: CustomTheme,
  scheme: ColorScheme,
  side: CustomSide,
  themes: readonly TerminalTheme[],
): FileSide {
  if (!("base" in side)) {
    return {
      ...side,
      terminal: serializeTerminal(side.terminal, scheme, themes),
    };
  }
  const out: FileSide = { ...side };
  if (side.terminal) {
    out.terminal = serializeTerminal(side.terminal, scheme, themes);
  }
  // Composing this side alone applies overrides and the terminal source exactly as the store does.
  const { id, label } = custom;
  const composed = composeTheme(
    scheme === "light" ? { id, label, light: side } : { id, label, dark: side },
    themes,
  );
  const palette = composed?.[scheme];
  if (palette) {
    out.resolved = { tokens: palette.tokens, terminal: palette.terminal };
  }
  return out;
}

function serializeTerminal(
  terminal: CustomTerminal,
  scheme: ColorScheme,
  themes: readonly TerminalTheme[],
): FileTerminal {
  if (!("base" in terminal)) return terminal;
  const base = themes.find((t) => t.id === terminal.base.theme);
  const resolved =
    base &&
    resolveTerminal(
      base,
      terminalScheme(base, terminal.base.scheme, scheme),
      terminal.base.variant,
    );
  if (!resolved) return terminal;
  return {
    ...terminal,
    resolved: { ...resolved.terminal, ...terminal.tokens },
  };
}

export type ImportStatus = "ok" | "renamed" | "adjusted" | "rejected";

export interface ImportEntry {
  /** The label as written in the file. */
  sourceLabel: string;
  /** The kind `theme` has, after any conversion. */
  kind: "ui" | "terminal";
  status: ImportStatus;
  /**
   * Present unless rejected: the theme to add, label de-duplicated, no id, no `resolved`. A UI
   * theme carries no `kind`; a terminal theme carries `kind: "terminal"`.
   */
  theme?: Omit<CustomTheme, "id" | "kind"> | Omit<CustomTerminalTheme, "id">;
  /** One sentence each, shown on the row: renames, repairs, or the rejection reason. */
  messages: string[];
}

export type ParseResult =
  | { ok: false; error: string }
  | { ok: true; entries: ImportEntry[] };

const NOT_JSON = "This isn't a theme file: it is not valid JSON.";
const NOT_ORZ = "This isn't an orz-themes file.";
const NEWER =
  "This file was written by a newer version and can't be read here.";
const TOO_LARGE = "This file is too large to be a theme file.";
const NO_THEMES = "This file contains no themes.";
const NO_SIDE = "It has neither a light nor a dark side.";
const BAD_SHAPE = "It isn't a valid theme entry.";
const NO_TERMINAL_SLOT =
  "It is a terminal theme, and this app has no terminal.";
const CONVERTED =
  "This app has no UI themes; imported as a terminal theme from its terminal colours.";

const renamed = (from: string) =>
  `Renamed from "${from}": a theme with that name already exists.`;
const sideDetached = (name: string, scheme: ColorScheme) =>
  `${name} isn't available here; the ${scheme} side is imported as Fully custom from the colours saved in the file.`;
const terminalDetached = (name: string, scheme: ColorScheme) =>
  `${name} isn't available here; the ${scheme} side's terminal is imported as Fully custom from the colours saved in the file.`;
const variantFallback = (name: string, variant: string, scheme: ColorScheme) =>
  `${name} has no variant "${variant}" here; the ${scheme} side uses Default.`;
const unknownTokens = (names: readonly string[]) =>
  `Ignored unknown colours: ${names.join(", ")}.`;
const noSnapshot = (name: string, scheme: ColorScheme) =>
  `${name} isn't available here and the file has no saved colours for the ${scheme} side.`;
// Not in the spec's table: a based terminal with a missing base and no snapshot.
const noTerminalSnapshot = (name: string, scheme: ColorScheme) =>
  `${name} isn't available here and the file has no saved colours for the ${scheme} side's terminal.`;
const terminalFollows = (name: string, scheme: ColorScheme) =>
  `${name} isn't available here and the file has no saved colours for the ${scheme} side's terminal; it follows the side's base instead.`;
const incomplete = (scheme: ColorScheme, names: readonly string[]) =>
  `Its ${scheme} side is missing colours: ${names.join(", ")}.`;
const notColour = (value: unknown, name: string) =>
  `"${show(value)}" for ${name} isn't a colour.`;
const notHex = (value: unknown, name: string) =>
  `"${show(value)}" for ${name} isn't a hex colour.`;

function show(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isColour = (value: unknown) =>
  typeof value === "string" && parseColor(value) !== null;
const isHex = (value: unknown) => typeof value === "string" && HEX.test(value);

interface RawTerminal {
  base?: { theme: string; scheme?: ColorScheme; variant?: string };
  tokens?: Json;
  resolved?: unknown;
}
interface RawSide {
  base?: { theme: string; variant?: string };
  tokens?: Json;
  terminal?: RawTerminal;
  resolved?: unknown;
}

const optional = (value: unknown, check: (v: unknown) => boolean) =>
  value === undefined || check(value);
const isString = (value: unknown) => typeof value === "string";
const isScheme = (value: unknown) => value === "light" || value === "dark";

function readTerminal(value: unknown): RawTerminal | null {
  if (!isObject(value)) return null;
  if (value.base === undefined) {
    return isObject(value.tokens) ? { tokens: value.tokens } : null;
  }
  const { base, tokens } = value;
  if (
    !isObject(base) ||
    !isString(base.theme) ||
    !optional(base.scheme, isScheme) ||
    !optional(base.variant, isString) ||
    !optional(tokens, isObject)
  ) {
    return null;
  }
  const out: RawTerminal = {
    base: {
      theme: base.theme as string,
      scheme: base.scheme as ColorScheme | undefined,
      variant: base.variant as string | undefined,
    },
    resolved: value.resolved,
  };
  if (tokens !== undefined) out.tokens = tokens as Json;
  return out;
}

function readSide(value: unknown): RawSide | null {
  if (!isObject(value)) return null;
  if (value.base === undefined) {
    const terminal = readTerminal(value.terminal);
    if (!isObject(value.tokens) || terminal === null) return null;
    return { tokens: value.tokens, terminal };
  }
  const { base, tokens } = value;
  if (
    !isObject(base) ||
    !isString(base.theme) ||
    !optional(base.variant, isString) ||
    !optional(tokens, isObject)
  ) {
    return null;
  }
  const out: RawSide = {
    base: {
      theme: base.theme as string,
      variant: base.variant as string | undefined,
    },
    resolved: value.resolved,
  };
  if (tokens !== undefined) out.tokens = tokens as Json;
  if (value.terminal !== undefined) {
    const terminal = readTerminal(value.terminal);
    if (terminal === null) return null;
    out.terminal = terminal;
  }
  return out;
}

/** The known names of `source`, in `names` order; unknown names are ignored. */
function pick<N extends string>(
  source: Json,
  names: readonly N[],
): Partial<Record<N, unknown>> {
  const out: Partial<Record<N, unknown>> = {};
  for (const name of names) {
    if (Object.hasOwn(source, name)) out[name] = source[name];
  }
  return out;
}

function unknownNames(source: Json | undefined, names: readonly string[]) {
  return source === undefined
    ? []
    : Object.keys(source).filter((key) => !names.includes(key));
}

function missingNames<N extends string>(
  source: Partial<Record<N, unknown>>,
  names: readonly N[],
): N[] {
  return names.filter((name) => !Object.hasOwn(source, name));
}

/** All of `names`, each valid, or null. */
function complete<N extends string>(
  source: unknown,
  names: readonly N[],
  valid: (value: unknown) => boolean,
): Record<N, string> | null {
  if (!isObject(source)) return null;
  const out = pick(source, names);
  if (missingNames(out, names).length > 0) return null;
  if (!Object.values(out).every(valid)) return null;
  return out as Record<N, string>;
}

/** The first value that fails `valid`, as a message; null when all pass. */
function badValue(
  source: Json,
  valid: (value: unknown) => boolean,
  message: (value: unknown, name: string) => string,
): string | null {
  for (const [name, value] of Object.entries(source)) {
    if (!valid(value)) return message(value, name);
  }
  return null;
}

interface CheckedSide {
  tokens?: Partial<Record<TokenName, unknown>>;
  terminalTokens?: Partial<Record<TerminalTokenName, unknown>>;
}

/** The side's known colours, or null when a value check drops it; its reason is in `messages`. */
function checkSide(
  raw: RawSide,
  scheme: ColorScheme,
  messages: string[],
): CheckedSide | null {
  const unknown = [
    ...unknownNames(raw.tokens, TOKEN_NAMES),
    ...unknownNames(raw.terminal?.tokens, TERMINAL_TOKEN_NAMES),
  ];
  if (unknown.length > 0) messages.push(unknownTokens(unknown));

  const tokens = raw.tokens && pick(raw.tokens, TOKEN_NAMES);
  const terminalTokens =
    raw.terminal?.tokens && pick(raw.terminal.tokens, TERMINAL_TOKEN_NAMES);
  const bad =
    (tokens && badValue(tokens, isColour, notColour)) ??
    (terminalTokens && badValue(terminalTokens, isHex, notHex));
  if (bad) {
    messages.push(bad);
    return null;
  }
  const missing = [
    ...(raw.base === undefined && tokens
      ? missingNames(tokens, TOKEN_NAMES)
      : []),
    ...(raw.terminal && raw.terminal.base === undefined && terminalTokens
      ? missingNames(terminalTokens, TERMINAL_TOKEN_NAMES)
      : []),
  ];
  if (missing.length > 0) {
    messages.push(incomplete(scheme, missing));
    return null;
  }
  return { tokens, terminalTokens };
}

/** null when the side is dropped; its reason is in `messages`. */
function importSide(
  raw: RawSide,
  scheme: ColorScheme,
  themes: readonly TerminalTheme[],
  messages: string[],
): CustomSide | null {
  const checked = checkSide(raw, scheme, messages);
  if (checked === null) return null;
  const { tokens, terminalTokens } = checked;

  let side: CustomSide;
  // The side's own snapshot terminal, when the side was detached from its snapshot.
  let snapshotTerminal: TerminalTokens | undefined;
  if (raw.base === undefined) {
    side = {
      tokens: tokens as Tokens,
      terminal: { tokens: terminalTokens as TerminalTokens },
    };
  } else {
    const base = themes.find((t) => t.id === raw.base?.theme);
    const palette = base && isUiTheme(base) ? base[scheme] : undefined;
    if (base && palette) {
      const ref: { theme: string; variant?: string } = { theme: base.id };
      const variant = raw.base.variant;
      if (variant !== undefined) {
        if (
          variant === DEFAULT_VARIANT ||
          Object.hasOwn(palette.variants ?? {}, variant)
        ) {
          ref.variant = variant;
        } else {
          messages.push(variantFallback(base.label, variant, scheme));
        }
      }
      side = { base: ref };
      if (tokens) side.tokens = tokens as Partial<Tokens>;
    } else {
      const name = base?.label ?? raw.base.theme;
      const resolved = isObject(raw.resolved) ? raw.resolved : {};
      const snapshotTokens = complete(resolved.tokens, TOKEN_NAMES, isColour);
      snapshotTerminal =
        complete(resolved.terminal, TERMINAL_TOKEN_NAMES, isHex) ?? undefined;
      if (snapshotTokens === null || snapshotTerminal === undefined) {
        messages.push(noSnapshot(name, scheme));
        return null;
      }
      messages.push(sideDetached(name, scheme));
      side = {
        tokens: snapshotTokens,
        terminal: { tokens: snapshotTerminal },
      };
    }
  }

  if (raw.terminal === undefined) return side;
  if (raw.terminal.base === undefined) {
    side.terminal = { tokens: terminalTokens as TerminalTokens };
    return side;
  }
  const terminal = importBasedTerminal(
    raw.terminal.base,
    raw.terminal.resolved,
    terminalTokens,
    scheme,
    themes,
    messages,
    terminalDetached,
  );
  if (terminal) {
    side.terminal = terminal;
    return side;
  }
  const name =
    themes.find((t) => t.id === raw.terminal?.base?.theme)?.label ??
    raw.terminal.base.theme;
  if ("base" in side) {
    messages.push(terminalFollows(name, scheme));
    return side;
  }
  // The side's snapshot already holds the terminal it showed, source included.
  if (snapshotTerminal) {
    messages.push(terminalDetached(name, scheme));
    return side;
  }
  messages.push(noTerminalSnapshot(name, scheme));
  return null;
}

/**
 * null when the base is missing here and the terminal has no usable snapshot. `detached` words the
 * message for a terminal made fully custom from its snapshot.
 */
function importBasedTerminal(
  ref: NonNullable<RawTerminal["base"]>,
  resolved: unknown,
  tokens: Partial<Record<TerminalTokenName, unknown>> | undefined,
  scheme: ColorScheme,
  themes: readonly TerminalTheme[],
  messages: string[],
  detached: (name: string, scheme: ColorScheme) => string,
): CustomTerminal | null {
  const base = themes.find((t) => t.id === ref.theme);
  const palette = base
    ? base[terminalScheme(base, ref.scheme, scheme)]
    : undefined;
  if (base && palette) {
    const kept: { theme: string; scheme?: ColorScheme; variant?: string } = {
      theme: base.id,
    };
    if (ref.scheme !== undefined) kept.scheme = ref.scheme;
    const variant = ref.variant;
    if (variant !== undefined) {
      if (
        variant === DEFAULT_VARIANT ||
        Object.hasOwn(palette.variants ?? {}, variant)
      ) {
        kept.variant = variant;
      } else {
        messages.push(variantFallback(base.label, variant, scheme));
      }
    }
    const terminal: CustomTerminal = { base: kept };
    if (tokens) terminal.tokens = tokens as Partial<TerminalTokens>;
    return terminal;
  }
  const snapshot = complete(resolved, TERMINAL_TOKEN_NAMES, isHex);
  if (snapshot === null) return null;
  messages.push(detached(base?.label ?? ref.theme, scheme));
  return { tokens: snapshot };
}

/** A terminal theme's side; null when it is dropped, its reason in `messages`. */
function importTerminalSide(
  raw: RawTerminal,
  scheme: ColorScheme,
  themes: readonly TerminalTheme[],
  messages: string[],
): CustomTerminal | null {
  const unknown = unknownNames(raw.tokens, TERMINAL_TOKEN_NAMES);
  if (unknown.length > 0) messages.push(unknownTokens(unknown));
  const tokens = raw.tokens && pick(raw.tokens, TERMINAL_TOKEN_NAMES);
  const bad = tokens && badValue(tokens, isHex, notHex);
  if (bad) {
    messages.push(bad);
    return null;
  }
  if (raw.base === undefined) {
    const missing = tokens ? missingNames(tokens, TERMINAL_TOKEN_NAMES) : [];
    if (missing.length > 0) {
      messages.push(incomplete(scheme, missing));
      return null;
    }
  }
  return resolveTerminalSide(raw, tokens, scheme, themes, messages);
}

/** A checked terminal side with its base reference resolved against `themes`. */
function resolveTerminalSide(
  raw: RawTerminal,
  tokens: Partial<Record<TerminalTokenName, unknown>> | undefined,
  scheme: ColorScheme,
  themes: readonly TerminalTheme[],
  messages: string[],
): CustomTerminal | null {
  if (raw.base === undefined) return { tokens: tokens as TerminalTokens };
  const terminal = importBasedTerminal(
    raw.base,
    raw.resolved,
    tokens,
    scheme,
    themes,
    messages,
    sideDetached,
  );
  if (terminal) return terminal;
  const name =
    themes.find((t) => t.id === raw.base?.theme)?.label ?? raw.base.theme;
  messages.push(noSnapshot(name, scheme));
  return null;
}

/** A UI side turned into the terminal it shows, for a store with no UI slot. */
function convertSide(
  raw: RawSide,
  scheme: ColorScheme,
  themes: readonly TerminalTheme[],
  messages: string[],
): CustomTerminal | null {
  const checked = checkSide(raw, scheme, messages);
  if (checked === null) return null;
  if (raw.terminal) {
    return resolveTerminalSide(
      raw.terminal,
      checked.terminalTokens,
      scheme,
      themes,
      messages,
    );
  }
  // A based side following its base: the base's own terminal, with the
  // terminal the side showed as its snapshot.
  const base = raw.base as NonNullable<RawSide["base"]>;
  const resolved = isObject(raw.resolved) ? raw.resolved.terminal : undefined;
  return resolveTerminalSide(
    { base: { theme: base.theme, variant: base.variant }, resolved },
    undefined,
    scheme,
    themes,
    messages,
  );
}

type Slots = NonNullable<ParseThemeFileOptions["slots"]>;

function importEntry(
  raw: unknown,
  fileKind: "ui" | "terminal",
  themes: readonly TerminalTheme[],
  taken: readonly string[],
  slots: Slots,
): ImportEntry {
  const sourceLabel =
    isObject(raw) && typeof raw.label === "string" ? raw.label : "";
  const converted = fileKind === "ui" && !slots.ui;
  const kind = converted ? "terminal" : fileKind;
  const rejected = (messages: string[]): ImportEntry => ({
    sourceLabel,
    kind,
    status: "rejected",
    messages,
  });
  if (!isObject(raw) || sourceLabel.trim() === "") {
    return rejected([BAD_SHAPE]);
  }
  const read = fileKind === "ui" ? readSide : readTerminal;
  const sides: Partial<Record<ColorScheme, RawSide | RawTerminal>> = {};
  for (const scheme of SCHEMES) {
    if (raw[scheme] === undefined) continue;
    const side = read(raw[scheme]);
    if (side === null) return rejected([BAD_SHAPE]);
    sides[scheme] = side;
  }
  if (!sides.light && !sides.dark) return rejected([NO_SIDE]);
  if (fileKind === "terminal" && !slots.terminal) {
    return rejected([NO_TERMINAL_SLOT]);
  }

  const messages: string[] = converted ? [CONVERTED] : [];
  const label = sourceLabel.trim();
  const theme:
    | Omit<CustomTheme, "id" | "kind">
    | Omit<CustomTerminalTheme, "id"> =
    kind === "terminal" ? { kind: "terminal", label } : { label };
  for (const scheme of SCHEMES) {
    const raw = sides[scheme];
    if (raw === undefined) continue;
    const side =
      fileKind === "terminal"
        ? importTerminalSide(raw, scheme, themes, messages)
        : converted
          ? convertSide(raw as RawSide, scheme, themes, messages)
          : importSide(raw as RawSide, scheme, themes, messages);
    // The kind decides the side type; the union cannot follow it.
    if (side) (theme as Record<ColorScheme, unknown>)[scheme] = side;
  }
  if (!theme.light && !theme.dark) return rejected(messages);

  theme.label = uniqueLabel(label, taken);
  const repaired = messages.length > 0;
  if (theme.label !== label)
    messages.splice(converted ? 1 : 0, 0, renamed(label));
  const status: ImportStatus = repaired
    ? "adjusted"
    : messages.length > 0
      ? "renamed"
      : "ok";
  return { sourceLabel, kind, status, theme, messages };
}

export interface ParseThemeFileOptions {
  /** The store's slots. Default both true. */
  slots?: { ui: boolean; terminal: boolean };
}

/**
 * Parses and validates a theme file against this app's lists. `existingLabels` are the labels the
 * new themes must not take (custom themes of both kinds, and the base themes of both slots);
 * de-duplication also covers labels taken by earlier entries of the same file. Entries come out
 * in file order, `themes` first, then `terminalThemes`. Never throws.
 */
export function parseThemeFile(
  text: string,
  themes: readonly TerminalTheme[],
  existingLabels: readonly string[],
  { slots = { ui: true, terminal: true } }: ParseThemeFileOptions = {},
): ParseResult {
  if (typeof text !== "string") return { ok: false, error: NOT_JSON };
  if (text.length > THEME_FILE_MAX_LENGTH) {
    return { ok: false, error: TOO_LARGE };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: NOT_JSON };
  }
  if (!isObject(data) || data.format !== THEME_FILE_FORMAT) {
    return { ok: false, error: NOT_ORZ };
  }
  if (typeof data.version === "number" && data.version > THEME_FILE_VERSION) {
    return { ok: false, error: NEWER };
  }
  if (data.version !== THEME_FILE_VERSION) return { ok: false, error: NOT_ORZ };
  const { themes: ui = [], terminalThemes: terminal = [] } = data;
  if (!Array.isArray(ui) || !Array.isArray(terminal)) {
    return { ok: false, error: NOT_ORZ };
  }
  if (ui.length === 0 && terminal.length === 0) {
    return { ok: false, error: NO_THEMES };
  }
  const taken = [...existingLabels];
  const entries = [
    ...ui.map((raw: unknown) => ["ui", raw] as const),
    ...terminal.map((raw: unknown) => ["terminal", raw] as const),
  ].map(([kind, raw]) => {
    const entry = importEntry(raw, kind, themes, taken, slots);
    if (entry.theme) taken.push(entry.theme.label);
    return entry;
  });
  return { ok: true, entries };
}

/** "X", or "X (n)" with the lowest n ≥ 2 that is free, compared case-insensitively. */
export function uniqueLabel(label: string, taken: readonly string[]): string {
  const trimmed = label.trim();
  const used = new Set(taken.map((t) => t.trim().toLowerCase()));
  if (!used.has(trimmed.toLowerCase())) return trimmed;
  for (let n = 2; ; n++) {
    const candidate = `${trimmed} (${n})`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}
