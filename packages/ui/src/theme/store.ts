import {
  type ColorScheme,
  type CustomTheme,
  composeTheme,
  isUiTheme,
  renderDeclarations,
  renderTerminalDeclarations,
  resolvePalette,
  resolveTerminal,
  type TerminalTheme,
  type TerminalTokens,
  type Theme,
  type Tokens,
} from "@orz/themes";
import { parseCustomThemes } from "./custom.ts";
import {
  fitPick,
  normalizePref,
  readStoredPref,
  type ThemeMode,
  type ThemePick,
  type ThemePref,
} from "./pref.ts";

const DARK_QUERY = "(prefers-color-scheme: dark)";
// The <html> rule's element carries an empty value, as the paint guard's
// does; a store on its own root marks its element with that root's id.
const STYLE_SELECTOR = 'style[data-orz-theme=""]';
// Shared, so a missing slot's getter is as stable a snapshot as the others.
const NO_THEMES: readonly Theme[] = Object.freeze([]);
const NO_TERMINAL_THEMES: readonly TerminalTheme[] = Object.freeze([]);
let nextRootId = 0;

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

/** A pick by id, or an unsaved theme carried as an object (the editor's draft). */
export type PreviewPick =
  | ThemePick
  | { theme: TerminalTheme; mode: ThemeMode; variant?: string };

export interface ThemePreview {
  ui?: PreviewPick;
  /** "follow" previews the terminal following the (shown) UI. */
  terminal?: PreviewPick | "follow";
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
  /** localStorage key holding the custom themes as JSON. Default `${storageKey}-custom`. */
  customStorageKey?: string;
  /** false: the store never reads or writes custom themes in localStorage; the app owns them. Default true. */
  persistCustomThemes?: boolean;
}

export interface ThemeStore {
  /** Normalized; the same object until it changes. */
  getPref(): ThemePref;
  /** What is shown, the preview included. null in a terminal-only store. The same object until it changes. */
  getResolved(): ResolvedTheme | null;
  /** What is shown, the preview included. The same object until it changes. */
  getTerminal(): ResolvedTerminalTheme;
  /** [] without a UI slot. The composed custom themes first, then the base list. */
  getThemes(): readonly Theme[];
  /** [] without a terminal slot. The composed custom themes first, then the base list. */
  getTerminalThemes(): readonly TerminalTheme[];
  /** Normalizes, persists, applies, notifies. Clears the preview. */
  setPref(next: ThemePref): void;
  /**
   * Shows `next` without persisting it; `null` shows the committed pick again.
   * A slot absent from `next` shows its committed pick. Throws when `next.ui`
   * carries an object that is not a UI theme (`isUiTheme`).
   */
  preview(next: ThemePreview | null): void;
  /** The active preview, or null. The same object until it changes. */
  getPreview(): ThemePreview | null;
  /** Only on a store with a UI slot; non-empty. Replaces the base list. */
  setThemes(next: readonly Theme[]): void;
  /** Only on a store with a terminal slot; non-empty. Replaces the base list. */
  setTerminalThemes(next: readonly TerminalTheme[]): void;
  /** Every stored custom theme, including those that compose to null. The same array until it changes. */
  getCustomThemes(): readonly CustomTheme[];
  /**
   * Replaces the list, persists it (unless `persistCustomThemes: false`),
   * re-composes the theme lists, notifies. Throws on an id that repeats or
   * equals a base theme's id.
   */
  setCustomThemes(next: readonly CustomTheme[]): void;
  subscribe(listener: () => void): () => void;
  /** Detaches the media-query and cross-tab listeners, and clears the preview. */
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

/** A pick and the theme it names (or carries), fitted to each other. */
interface Shown<T extends TerminalTheme> {
  theme: T;
  pick: ThemePick;
}

function find<T extends TerminalTheme>(
  list: readonly T[],
  pick: PreviewPick,
): Shown<T> | null {
  const theme =
    typeof pick.theme === "string"
      ? list.find((t) => t.id === pick.theme)
      : (pick.theme as T);
  if (theme === undefined) return null;
  const fitted: ThemePick = { theme: theme.id, mode: pick.mode };
  if (pick.variant !== undefined) fitted.variant = pick.variant;
  return { theme, pick: fitPick(fitted, theme) };
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
  customStorageKey = `${storageKey}-custom`,
  persistCustomThemes = true,
}: ThemeStoreOptions): ThemeStore {
  if (initialThemes === undefined && initialTerminalThemes === undefined) {
    throw new Error("createThemeStore: pass themes, terminalThemes or both");
  }
  let baseThemes = slot(initialThemes, "themes");
  let baseTerminalThemes = slot(initialTerminalThemes, "terminalThemes");
  let customs: readonly CustomTheme[] = [];
  // What the slots show: the composed custom themes, then the base list.
  let themes = baseThemes;
  let terminalThemes = baseTerminalThemes;

  const browser = typeof window !== "undefined";
  const media =
    browser && typeof window.matchMedia === "function"
      ? window.matchMedia(DARK_QUERY)
      : null;
  const target = root ?? (browser ? document.documentElement : null);
  const ownRoot =
    browser && root !== undefined && root !== document.documentElement;
  // Each store on its own root scopes its rule to that root, so two such
  // stores never repaint each other's.
  const rootId = ownRoot ? `r${nextRootId++}` : "";
  const listeners = new Set<() => void>();

  // What was asked for, kept apart from the normalized pref so a theme that
  // arrives later through setThemes (a custom one) gets its pick back.
  let requested: ThemePref = {};
  let pref: ThemePref = {};
  let resolved: ResolvedTheme | null = null;
  let terminal = null as unknown as ResolvedTerminalTheme;
  let uiTokens: Tokens | null = null;
  let shown: ThemePreview | null = null;
  // What resolve() last chose to show for each slot; a null terminal follows.
  let shownUi: Shown<Theme> | null = null;
  let shownTerminal: Shown<TerminalTheme> | null = null;

  const slots = () => ({ themes, terminalThemes });
  // A missing pick falls back to the first base theme: adding a custom theme
  // must not change what a user who never picked sees.
  const fallback = () => ({
    themes: baseThemes,
    terminalThemes: baseTerminalThemes,
  });
  const persistsCustom = browser && persistCustomThemes;
  const baseIds = () =>
    new Set(
      [...(baseThemes ?? []), ...(baseTerminalThemes ?? [])].map((t) => t.id),
    );

  function recompose() {
    const base = [...(baseThemes ?? []), ...(baseTerminalThemes ?? [])];
    const taken = baseIds();
    const composed: Theme[] = [];
    for (const custom of customs) {
      // A stored list skips setCustomThemes' checks, and a base list may gain
      // a custom's id later: the id stays with whichever theme had it first.
      if (taken.has(custom.id)) continue;
      const theme = composeTheme(custom, base);
      if (theme === null) continue;
      taken.add(theme.id);
      composed.push(theme);
    }
    themes = baseThemes && [...composed, ...baseThemes];
    terminalThemes = baseTerminalThemes && [...composed, ...baseTerminalThemes];
  }

  function readCustom(): readonly CustomTheme[] {
    try {
      return parseCustomThemes(localStorage.getItem(customStorageKey));
    } catch {
      return [];
    }
  }

  function readStored(): ThemePref {
    try {
      return readStoredPref(localStorage.getItem(storageKey));
    } catch {
      // storage may be unavailable (private mode)
      return {};
    }
  }

  function renormalize() {
    const next = normalizePref(requested, slots(), fallback());
    if (!same(next, pref)) pref = next;
  }

  function schemeOf(mode: ThemeMode): ColorScheme {
    if (mode !== "system") return mode;
    return media?.matches ? "dark" : "light";
  }

  /** The preview's pick for a slot where it names one that exists, else the committed one. */
  function pickFor<T extends TerminalTheme>(
    list: readonly T[],
    previewed: PreviewPick | undefined,
    committed: ThemePick | undefined,
  ): Shown<T> | null {
    return (
      (previewed && find(list, previewed)) ??
      (committed ? find(list, committed) : null)
    );
  }

  function resolve() {
    shownUi = themes ? pickFor(themes, shown?.ui, pref.ui) : null;
    const terminalPreview = shown?.terminal;
    // Following needs a UI to follow; a terminal-only store ignores it.
    shownTerminal =
      !terminalThemes || (terminalPreview === "follow" && themes)
        ? null
        : pickFor(
            terminalThemes,
            terminalPreview === "follow" ? undefined : terminalPreview,
            pref.terminal,
          );

    let nextResolved: ResolvedTheme | null = null;
    let nextTerminal: ResolvedTerminalTheme;
    let uiTerminal: TerminalTokens | null = null;
    if (shownUi) {
      const { theme, pick: ui } = shownUi;
      const colorScheme = schemeOf(ui.mode);
      const palette = resolvePalette(theme, colorScheme, ui.variant);
      if (palette !== null) {
        nextResolved = { theme, colorScheme, variant: palette.variant };
        uiTerminal = palette.terminal;
        uiTokens = palette.tokens;
      }
    }
    if (shownTerminal) {
      const { theme, pick } = shownTerminal;
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
    style.setAttribute("data-orz-theme", rootId);
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
    const selector = ownRoot ? `[data-orz-theme-root="${rootId}"]` : ":root";
    styleElement().textContent = `${selector} { ${declarations.join(" ")} }`;

    if (ownRoot) target.setAttribute("data-orz-theme-root", rootId);
    // A terminal-only store leaves the page's own colours alone.
    if (resolved !== null && shownUi) {
      target.classList.toggle("dark", resolved.colorScheme === "dark");
      target.dataset.theme = resolved.theme.id;
      if (shownUi.pick.variant) target.dataset.variant = shownUi.pick.variant;
      else delete target.dataset.variant;
    }
    if (shownTerminal) target.dataset.terminalTheme = shownTerminal.theme.id;
    else delete target.dataset.terminalTheme;
  }

  function writePaintCache() {
    try {
      localStorage.setItem(paintKey, JSON.stringify(paintCache()));
    } catch {
      // the next load just paints late
    }
  }

  /** `committed: false` for a preview, which the next load must not paint. */
  function apply(committed = true) {
    resolve();
    if (!browser) return;
    paint();
    if (committed) writePaintCache();
  }

  function notify() {
    for (const l of listeners) l();
  }

  const onMediaChange = () => {
    if (
      shownUi?.pick.mode === "system" ||
      shownTerminal?.pick.mode === "system"
    ) {
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
    } else if (persistsCustom && e.key === customStorageKey) {
      customs = readCustom();
      recompose();
      renormalize();
      apply();
      notify();
    }
  };

  // Read before the first normalization, so a stored pick naming a custom
  // theme paints on creation. Never written back from here: a list this
  // version cannot fully read may be a newer version's.
  if (persistsCustom) customs = readCustom();
  recompose();
  requested = browser ? readStored() : {};
  pref = normalizePref(requested, slots(), fallback());
  apply();
  if (browser) {
    media?.addEventListener("change", onMediaChange);
    window.addEventListener("storage", onStorage);
  }

  return {
    getPref: () => pref,
    getResolved: () => resolved,
    getTerminal: () => terminal,
    getThemes: () => themes ?? NO_THEMES,
    getTerminalThemes: () => terminalThemes ?? NO_TERMINAL_THEMES,
    setPref(next) {
      shown = null;
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
      baseThemes = slot(next, "themes");
      recompose();
      renormalize();
      apply();
      notify();
    },
    setTerminalThemes(next) {
      if (terminalThemes === undefined) {
        throw new Error("setTerminalThemes: this store has no terminal slot");
      }
      baseTerminalThemes = slot(next, "terminalThemes");
      recompose();
      renormalize();
      apply();
      notify();
    },
    preview(next) {
      if (next === shown) return;
      const ui = next?.ui;
      if (ui && typeof ui.theme !== "string" && !isUiTheme(ui.theme)) {
        throw new Error(`preview: ${ui.theme.id} is not a UI theme`);
      }
      shown = next;
      apply(false);
      notify();
    },
    getPreview: () => shown,
    getCustomThemes: () => customs,
    setCustomThemes(next) {
      const taken = baseIds();
      const ids = new Set<string>();
      for (const { id } of next) {
        if (ids.has(id)) {
          throw new Error(`setCustomThemes: id ${id} appears twice`);
        }
        if (taken.has(id)) {
          throw new Error(`setCustomThemes: id ${id} is a base theme's`);
        }
        ids.add(id);
      }
      customs = [...next];
      if (persistsCustom) {
        try {
          localStorage.setItem(customStorageKey, JSON.stringify(customs));
        } catch {
          // the list just won't persist
        }
      }
      recompose();
      renormalize();
      apply();
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (shown !== null) {
        shown = null;
        apply(false);
      }
      media?.removeEventListener("change", onMediaChange);
      if (browser) window.removeEventListener("storage", onStorage);
      if (ownRoot) {
        style?.remove();
        target?.removeAttribute("data-orz-theme-root");
      }
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
