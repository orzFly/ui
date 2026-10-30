import {
  type ColorScheme,
  DEFAULT_STYLE,
  DEFAULT_VARIANT,
  type TerminalTheme,
  type Theme,
  themesForStyle,
} from "@orz/themes";

export type ThemeMode = "system" | ColorScheme;
export interface ThemePick {
  theme: string;
  mode: ThemeMode;
  /** One id for the whole theme; absent = "default". */
  variant?: string;
}
export interface ThemePref {
  /** Present exactly when the store has a UI slot. Always a theme of `style`. */
  ui?: ThemePick;
  /** Absent = the terminal follows the UI pick. */
  terminal?: ThemePick;
  /** The style the UI is drawn in; absent = the store's default style. Only with a UI slot. */
  style?: string;
  /** The UI pick last made under each other offered style, which switching back to it restores. */
  uiByStyle?: Record<string, ThemePick>;
}

export interface ThemeSlots {
  themes?: readonly Theme[];
  terminalThemes?: readonly TerminalTheme[];
  /** The ids of the styles offered; absent = the default style alone. */
  styles?: readonly string[];
  /** Absent = "default" when it is offered, else the first of `styles`. */
  defaultStyle?: string;
}

/** The style an absent `ThemePref.style` stands for. */
export function defaultStyleOf(slots: ThemeSlots): string {
  const styles = slots.styles ?? [DEFAULT_STYLE];
  return (
    slots.defaultStyle ??
    (styles.includes(DEFAULT_STYLE) ? DEFAULT_STYLE : (styles[0] as string))
  );
}

/** The themes a style can show: its own, or every theme when it has none. */
export function themesShownFor<T extends Theme>(
  themes: readonly T[],
  style: string,
): readonly T[] {
  const own = themesForStyle(themes, style);
  return own.length > 0 ? own : themes;
}

/**
 * The slugs `@orz/ui` stored before themes became data, so a pref saved by
 * an app that adopts the store keeps its theme.
 */
export const LEGACY_THEME_PREFS: Readonly<Record<string, ThemePick>> = {
  system: { theme: "default", mode: "system" },
  light: { theme: "default", mode: "light" },
  dark: { theme: "default", mode: "dark" },
  "pico-light": { theme: "picotera", mode: "light" },
  "tera-dark": { theme: "picotera", mode: "dark" },
  "solarized-light": { theme: "solarized", mode: "light" },
  "solarized-dark": { theme: "solarized", mode: "dark" },
  "vs-light": { theme: "vs", mode: "light" },
  "vs-dark": { theme: "vs", mode: "dark" },
  "github-light": { theme: "github", mode: "light" },
  "github-dark": { theme: "github", mode: "dark" },
  "catppuccin-latte": { theme: "catppuccin", mode: "light" },
  "catppuccin-mocha": { theme: "catppuccin", mode: "dark" },
  "gruvbox-light": { theme: "gruvbox", mode: "light" },
  "gruvbox-dark": { theme: "gruvbox", mode: "dark" },
  dracula: { theme: "dracula", mode: "dark" },
  nord: { theme: "nord", mode: "dark" },
  "tokyo-night": { theme: "tokyo-night", mode: "dark" },
  "one-dark": { theme: "one-dark", mode: "dark" },
  monokai: { theme: "monokai", mode: "dark" },
};

const MODES: readonly unknown[] = ["system", "light", "dark"];

/** A pick from untrusted JSON, or undefined when it names no theme. */
function pickOf(value: unknown): ThemePick | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { theme, mode, variant } = value as Record<string, unknown>;
  if (typeof theme !== "string") return undefined;
  const pick: ThemePick = {
    theme,
    mode: MODES.includes(mode) ? (mode as ThemeMode) : "system",
  };
  if (typeof variant === "string") pick.variant = variant;
  return pick;
}

function definesVariant(theme: TerminalTheme, id: string): boolean {
  return [theme.light, theme.dark].some(
    (palette) =>
      palette?.variants !== undefined && Object.hasOwn(palette.variants, id),
  );
}

/** The pick made valid for one theme: a possible mode, a defined variant. */
export function fitPick(pick: ThemePick, theme: TerminalTheme): ThemePick {
  const mode =
    theme.light && theme.dark ? pick.mode : theme.light ? "light" : "dark";
  const out: ThemePick = { theme: theme.id, mode };
  if (
    pick.variant !== undefined &&
    pick.variant !== DEFAULT_VARIANT &&
    definesVariant(theme, pick.variant)
  ) {
    out.variant = pick.variant;
  }
  return out;
}

const SYSTEM = (theme: TerminalTheme) =>
  fitPick({ theme: theme.id, mode: "system" }, theme);

/** The remembered picks of the offered styles other than `current`; undefined when none. */
function byStyleOf(
  value: unknown,
  styles: readonly string[],
  current: string,
): Record<string, ThemePick> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const out: Record<string, ThemePick> = {};
  for (const id of styles) {
    if (id === current || !Object.hasOwn(value, id)) continue;
    const pick = pickOf((value as Record<string, unknown>)[id]);
    if (pick) out[id] = pick;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * The pref made valid for the slots the store has. A UI pick naming no theme
 * of the style falls back to the style's first in `fallback`'s list, by
 * default the slot's own. A remembered pick is kept as asked for: its theme
 * may arrive later, and switching to its style checks it then.
 */
export function normalizePref(
  pref: ThemePref,
  slots: ThemeSlots,
  fallback: ThemeSlots = slots,
): ThemePref {
  const out: ThemePref = {};
  const ui = pickOf(pref.ui);
  const terminal = pickOf(pref.terminal);
  const uiSlot = slots.themes !== undefined && slots.themes.length > 0;

  if (uiSlot) {
    const styles = slots.styles ?? [DEFAULT_STYLE];
    const defaultStyle = defaultStyleOf(slots);
    const style =
      typeof pref.style === "string" && styles.includes(pref.style)
        ? pref.style
        : defaultStyle;
    const all = slots.themes as readonly Theme[];
    const themes = themesShownFor(all, style);
    const theme = ui && themes.find((t) => t.id === ui.theme);
    out.ui =
      ui && theme
        ? fitPick(ui, theme)
        : SYSTEM(themesShownFor(fallback.themes ?? all, style)[0] as Theme);
    if (style !== defaultStyle) out.style = style;
    const byStyle = byStyleOf(pref.uiByStyle, styles, style);
    if (byStyle) out.uiByStyle = byStyle;
  }

  const terminalThemes = slots.terminalThemes;
  if (terminalThemes !== undefined && terminalThemes.length > 0) {
    const theme =
      terminal && terminalThemes.find((t) => t.id === terminal.theme);
    if (terminal && theme) out.terminal = fitPick(terminal, theme);
    // Without a UI to follow, the terminal always has a pick of its own.
    else if (!uiSlot) {
      out.terminal = SYSTEM((fallback.terminalThemes ?? terminalThemes)[0]);
    }
  }
  return out;
}

/**
 * The stored pref in the current shape, not yet fitted to any theme list:
 * the store keeps it as asked for, so a pick on a theme that arrives later
 * (a custom one) survives until it does.
 */
export function readStoredPref(raw: string | null): ThemePref {
  let parsed: unknown = raw;
  if (raw !== null) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      // a bare legacy slug is not JSON
    }
  }
  if (typeof parsed === "string") {
    const legacy = Object.hasOwn(LEGACY_THEME_PREFS, parsed)
      ? LEGACY_THEME_PREFS[parsed]
      : undefined;
    return legacy ? { ui: legacy } : {};
  }
  if (typeof parsed === "object" && parsed !== null) {
    const record = parsed as Record<string, unknown>;
    // The JSON shape @orz/ui stored a pick in before it had two slots.
    if ("theme" in record) {
      const ui = pickOf(record);
      return ui ? { ui } : {};
    }
    const out: ThemePref = {};
    const ui = pickOf(record.ui);
    const terminal = pickOf(record.terminal);
    if (ui) out.ui = ui;
    if (terminal) out.terminal = terminal;
    if (typeof record.style === "string") out.style = record.style;
    // Each pick is checked as normalizePref reads it.
    if (typeof record.uiByStyle === "object" && record.uiByStyle !== null) {
      out.uiByStyle = record.uiByStyle as Record<string, ThemePick>;
    }
    return out;
  }
  return {};
}

/** JSON in the current shape, else a legacy shape, else the fallback. */
export function parseStoredPref(
  raw: string | null,
  slots: ThemeSlots,
): ThemePref {
  return normalizePref(readStoredPref(raw), slots);
}
