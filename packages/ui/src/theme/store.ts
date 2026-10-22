import {
  type ColorScheme,
  renderDeclarations,
  renderTerminalDeclarations,
  resolvePalette,
  resolveTerminal,
  type TerminalTheme,
  type TerminalTokens,
  type Theme,
  type Tokens,
} from "@orz/themes";
import {
  normalizePref,
  parseStoredPref,
  type ThemeMode,
  type ThemePick,
  type ThemePref,
} from "./pref.ts";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const STYLE_SELECTOR = "style[data-orz-theme]";

export interface ResolvedTheme {
  theme: Theme;
  colorScheme: ColorScheme;
  /** The variant the active side shows ("default" when the picked one is not defined there). */
  variant: string;
}

export interface ResolvedTerminalTheme {
  /** True when no terminal pick exists and the terminal shows the UI palette's terminal tokens. */
  following: boolean;
  theme: TerminalTheme;
  colorScheme: ColorScheme;
  variant: string;
  tokens: TerminalTokens;
}

export interface ThemeStoreOptions {
  /** localStorage key holding the pref as JSON. Name it after the app; there is no default. */
  storageKey: string;
  /** localStorage key holding the paint cache. Default `${storageKey}-paint`. */
  paintKey?: string;
  /** The UI slot. Non-empty when given; on a duplicate id the first entry wins. */
  themes?: readonly Theme[];
  /** The terminal slot. Same rules. */
  terminalThemes?: readonly TerminalTheme[];
  /** Where the attributes and `.dark` are written. Default `<html>`. */
  root?: HTMLElement;
}

export interface ThemeStore {
  /** Normalized; the same object until it changes. */
  getPref(): ThemePref;
  /** null in a terminal-only store. The same object until it changes. */
  getResolved(): ResolvedTheme | null;
  /** The same object until it changes. */
  getTerminal(): ResolvedTerminalTheme;
  /** [] without a UI slot. */
  getThemes(): readonly Theme[];
  /** [] without a terminal slot. */
  getTerminalThemes(): readonly TerminalTheme[];
  /** Normalizes, persists, applies, notifies. */
  setPref(next: ThemePref): void;
  /** Only on a store with a UI slot; non-empty. */
  setThemes(next: readonly Theme[]): void;
  /** Only on a store with a terminal slot; non-empty. */
  setTerminalThemes(next: readonly TerminalTheme[]): void;
  subscribe(listener: () => void): () => void;
  /** Detaches the media-query and cross-tab listeners. */
  dispose(): void;
}

/** One side of the paint cache: the declarations each scheme would write. */
interface PaintSide {
  theme: string;
  variant?: string;
  light?: string;
  dark?: string;
}
interface PaintCache {
  ui?: PaintSide;
  terminal?: PaintSide;
}

function slot<T extends { id: string }>(
  list: readonly T[] | undefined,
  name: string,
): T[] | undefined {
  if (list === undefined) return undefined;
  if (list.length === 0) throw new Error(`createThemeStore: ${name} is empty`);
  const seen = new Set<string>();
  return list.filter((t) => !seen.has(t.id) && seen.add(t.id) !== undefined);
}

/** The schemes a pick can show: both under system on a two-palette theme. */
function schemesFor(pick: ThemePick): ColorScheme[] {
  return pick.mode === "system" ? ["light", "dark"] : [pick.mode];
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * The theme state for one app: the pref, its persistence, and the
 * `<style data-orz-theme>` rule and root attributes that paint it. Applies
 * the stored theme as soon as it is created, which is the one side effect
 * importing this package never has.
 *
 * Outside a browser it only remembers the pref, so server rendering and
 * tests can create one.
 */
export function createThemeStore({
  storageKey,
  paintKey = `${storageKey}-paint`,
  themes: initialThemes,
  terminalThemes: initialTerminalThemes,
  root,
}: ThemeStoreOptions): ThemeStore {
  if (initialThemes === undefined && initialTerminalThemes === undefined) {
    throw new Error("createThemeStore: pass themes, terminalThemes or both");
  }
  let themes = slot(initialThemes, "themes");
  let terminalThemes = slot(initialTerminalThemes, "terminalThemes");

  const browser = typeof window !== "undefined";
  const media =
    browser && typeof window.matchMedia === "function"
      ? window.matchMedia(DARK_QUERY)
      : null;
  const target = root ?? (browser ? document.documentElement : null);
  const ownRoot =
    browser && root !== undefined && root !== document.documentElement;
  const listeners = new Set<() => void>();

  // What was asked for, kept apart from the normalized pref so a theme that
  // arrives later through setThemes (a custom one) gets its pick back.
  let requested: ThemePref = {};
  let pref: ThemePref = {};
  let resolved: ResolvedTheme | null = null;
  let terminal = null as unknown as ResolvedTerminalTheme;
  let uiTokens: Tokens | null = null;

  const slots = () => ({ themes, terminalThemes });

  function readStored(): ThemePref {
    try {
      return parseStoredPref(localStorage.getItem(storageKey), slots());
    } catch {
      // storage may be unavailable (private mode)
      return normalizePref({}, slots());
    }
  }

  function renormalize() {
    const next = normalizePref(requested, slots());
    if (!same(next, pref)) pref = next;
  }

  function schemeOf(mode: ThemeMode): ColorScheme {
    if (mode !== "system") return mode;
    return media?.matches ? "dark" : "light";
  }

  function resolve() {
    let nextResolved: ResolvedTheme | null = null;
    let nextTerminal: ResolvedTerminalTheme;
    let uiTerminal: TerminalTokens | null = null;
    if (pref.ui && themes) {
      const ui = pref.ui;
      const theme = themes.find((t) => t.id === ui.theme) as Theme;
      const colorScheme = schemeOf(ui.mode);
      const palette = resolvePalette(theme, colorScheme, ui.variant);
      if (palette !== null) {
        nextResolved = { theme, colorScheme, variant: palette.variant };
        uiTerminal = palette.terminal;
        uiTokens = palette.tokens;
      }
    }
    if (pref.terminal && terminalThemes) {
      const pick = pref.terminal;
      const theme = terminalThemes.find(
        (t) => t.id === pick.theme,
      ) as TerminalTheme;
      const colorScheme = schemeOf(pick.mode);
      const own = resolveTerminal(theme, colorScheme, pick.variant);
      nextTerminal = {
        following: false,
        theme,
        colorScheme,
        variant: own?.variant ?? "default",
        tokens: own?.terminal ?? (uiTerminal as TerminalTokens),
      };
    } else {
      const ui = nextResolved as ResolvedTheme;
      nextTerminal = {
        following: true,
        theme: ui.theme,
        colorScheme: ui.colorScheme,
        variant: ui.variant,
        tokens: uiTerminal as TerminalTokens,
      };
    }
    // Keep the old objects when nothing moved, so useSyncExternalStore
    // readers do not re-render on an OS switch that changes nothing.
    if (!sameResolved(resolved, nextResolved)) resolved = nextResolved;
    if (!sameTerminal(terminal, nextTerminal)) terminal = nextTerminal;
  }

  function paintCache(): PaintCache {
    const cache: PaintCache = {};
    if (pref.ui && themes) {
      const ui = pref.ui;
      const theme = themes.find((t) => t.id === ui.theme) as Theme;
      const side: PaintSide = { theme: ui.theme };
      if (ui.variant) side.variant = ui.variant;
      for (const scheme of schemesFor(ui)) {
        const palette = resolvePalette(theme, scheme, ui.variant);
        if (palette === null) continue;
        side[scheme] =
          `${renderDeclarations(palette.tokens, scheme)} ${renderTerminalDeclarations(palette.terminal)}`;
      }
      cache.ui = side;
    }
    if (pref.terminal && terminalThemes) {
      const pick = pref.terminal;
      const theme = terminalThemes.find(
        (t) => t.id === pick.theme,
      ) as TerminalTheme;
      const side: PaintSide = { theme: pick.theme };
      if (pick.variant) side.variant = pick.variant;
      for (const scheme of schemesFor(pick)) {
        const own = resolveTerminal(theme, scheme, pick.variant);
        if (own !== null)
          side[scheme] = renderTerminalDeclarations(own.terminal);
      }
      cache.terminal = side;
    }
    return cache;
  }

  let style: HTMLStyleElement | null = null;
  function styleElement(): HTMLStyleElement {
    if (style?.isConnected) return style;
    // The paint guard's element is adopted rather than doubled; a store on
    // its own root keeps an element of its own, so it never repaints <html>.
    const found = ownRoot
      ? null
      : document.head.querySelector<HTMLStyleElement>(STYLE_SELECTOR);
    style = found ?? document.createElement("style");
    style.setAttribute("data-orz-theme", "");
    // Last in <head>, so the rule outranks the stylesheet's own :root/.dark
    // baseline, which ties with it on specificity.
    document.head.append(style);
    return style;
  }

  function paint() {
    if (target === null) return;
    const declarations: string[] = [];
    if (resolved !== null && uiTokens !== null) {
      declarations.push(renderDeclarations(uiTokens, resolved.colorScheme));
    }
    declarations.push(renderTerminalDeclarations(terminal.tokens));
    const selector = ownRoot ? "[data-orz-theme-root]" : ":root";
    styleElement().textContent = `${selector} { ${declarations.join(" ")} }`;

    if (ownRoot) target.setAttribute("data-orz-theme-root", "");
    // A terminal-only store leaves the page's own colours alone.
    if (resolved !== null && pref.ui) {
      target.classList.toggle("dark", resolved.colorScheme === "dark");
      target.dataset.theme = resolved.theme.id;
      if (pref.ui.variant) target.dataset.variant = pref.ui.variant;
      else delete target.dataset.variant;
    }
    if (pref.terminal) target.dataset.terminalTheme = pref.terminal.theme;
    else delete target.dataset.terminalTheme;
  }

  function writePaintCache() {
    try {
      localStorage.setItem(paintKey, JSON.stringify(paintCache()));
    } catch {
      // the next load just paints late
    }
  }

  function apply() {
    resolve();
    if (!browser) return;
    paint();
    writePaintCache();
  }

  function notify() {
    for (const l of listeners) l();
  }

  const onMediaChange = () => {
    if (pref.ui?.mode === "system" || pref.terminal?.mode === "system") {
      apply();
      notify();
    }
  };
  // Keep multiple open tabs in step.
  const onStorage = (e: StorageEvent) => {
    if (e.key === storageKey) {
      requested = readStored();
      renormalize();
      apply();
      notify();
    }
  };

  requested = browser ? readStored() : {};
  pref = normalizePref(requested, slots());
  apply();
  if (browser) {
    media?.addEventListener("change", onMediaChange);
    window.addEventListener("storage", onStorage);
  }

  return {
    getPref: () => pref,
    getResolved: () => resolved,
    getTerminal: () => terminal,
    getThemes: () => themes ?? [],
    getTerminalThemes: () => terminalThemes ?? [],
    setPref(next) {
      requested = next;
      renormalize();
      if (browser) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(pref));
        } catch {
          // preference just won't persist
        }
      }
      apply();
      notify();
    },
    setThemes(next) {
      if (themes === undefined) {
        throw new Error("setThemes: this store has no UI slot");
      }
      themes = slot(next, "themes");
      renormalize();
      apply();
      notify();
    },
    setTerminalThemes(next) {
      if (terminalThemes === undefined) {
        throw new Error("setTerminalThemes: this store has no terminal slot");
      }
      terminalThemes = slot(next, "terminalThemes");
      renormalize();
      apply();
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      media?.removeEventListener("change", onMediaChange);
      if (browser) window.removeEventListener("storage", onStorage);
      if (ownRoot) style?.remove();
      listeners.clear();
    },
  };
}

function sameResolved(a: ResolvedTheme | null, b: ResolvedTheme | null) {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      a.theme === b.theme &&
      a.colorScheme === b.colorScheme &&
      a.variant === b.variant)
  );
}

function sameTerminal(
  a: ResolvedTerminalTheme | null,
  b: ResolvedTerminalTheme,
) {
  return (
    a !== null &&
    a.following === b.following &&
    a.theme === b.theme &&
    a.colorScheme === b.colorScheme &&
    a.variant === b.variant &&
    same(a.tokens, b.tokens)
  );
}
