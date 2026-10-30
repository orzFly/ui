import {
  type AnyCustomTheme,
  type ColorScheme,
  DEFAULT_STYLE,
  defaultStyle,
  type Style,
  type TerminalTheme,
  type TerminalTokens,
  type Theme,
} from "@orz/themes";
import { defaultTheme } from "@orz/themes/themes/default";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { prefForStyle } from "./picks.ts";
import type { ThemePref } from "./pref.ts";
import type {
  ResolvedTerminalTheme,
  ResolvedTheme,
  ThemePreview,
  ThemeStore,
} from "./store.ts";

const ThemeContext = createContext<ThemeStore | null>(null);

export function ThemeProvider({
  store,
  children,
}: {
  store: ThemeStore;
  children?: ReactNode;
}) {
  return <ThemeContext value={store}>{children}</ThemeContext>;
}

const noop = () => {};
const subscribeNowhere = () => noop;

// What a primitive rendered outside any provider (or under a terminal-only
// store) paints with: the stylesheet's own :root baseline.
const FALLBACK_PREF: ThemePref = { ui: { theme: "default", mode: "system" } };
const FALLBACK_THEMES: readonly Theme[] = [defaultTheme];
const FALLBACK_RESOLVED: ResolvedTheme = {
  theme: defaultTheme,
  colorScheme: "light",
  style: DEFAULT_STYLE,
  variant: "default",
};
const FALLBACK_STYLES: readonly Style[] = [defaultStyle];
const fallbackStyle = () => DEFAULT_STYLE;
const fallbackStyles = () => FALLBACK_STYLES;
const FALLBACK_TERMINAL: ResolvedTerminalTheme = {
  following: true,
  theme: defaultTheme,
  colorScheme: "light",
  variant: "default",
  tokens: (defaultTheme.light as { terminal: TerminalTokens }).terminal,
};
const fallbackPref = () => FALLBACK_PREF;
const fallbackResolved = () => FALLBACK_RESOLVED;
const fallbackTerminal = () => FALLBACK_TERMINAL;
const fallbackThemes = () => FALLBACK_THEMES;
const NO_CUSTOM_THEMES: readonly AnyCustomTheme[] = Object.freeze([]);
const fallbackCustomThemes = () => NO_CUSTOM_THEMES;

interface CustomThemeControls {
  preview: (next: ThemePreview | null) => void;
  customThemes: readonly AnyCustomTheme[];
  setCustomThemes: (next: readonly AnyCustomTheme[]) => void;
}

/** What both hooks add for a picker or an editor: preview and the custom list. */
function useCustomThemeControls(
  store: ThemeStore | null,
  subscribe: ThemeStore["subscribe"],
): CustomThemeControls {
  const getCustomThemes = store?.getCustomThemes ?? fallbackCustomThemes;
  const customThemes = useSyncExternalStore(
    subscribe,
    getCustomThemes,
    getCustomThemes,
  );
  return {
    preview: store?.preview ?? noop,
    customThemes,
    setCustomThemes: store?.setCustomThemes ?? noop,
  };
}

/**
 * The provider's UI theme, as shown (a preview included); `pref` is the
 * committed pick. Outside a provider it answers the default theme under
 * system, light, and ignores `setPref`, `preview` and `setCustomThemes`, so a
 * primitive rendered on its own still renders.
 */
export function useTheme(): {
  pref: ThemePref;
  themes: readonly Theme[];
  theme: Theme;
  colorScheme: ColorScheme;
  variant: string;
  setPref: (next: ThemePref) => void;
} & CustomThemeControls {
  const store = useContext(ThemeContext);
  const subscribe = store?.subscribe ?? subscribeNowhere;
  const getPref = store?.getPref ?? fallbackPref;
  // Read apart from the pref: under "system" an OS switch changes the
  // resolved theme while the pref snapshot stays the same.
  const getResolved = store
    ? () => store.getResolved() ?? FALLBACK_RESOLVED
    : fallbackResolved;
  const getThemes =
    store && store.getThemes().length > 0 ? store.getThemes : fallbackThemes;
  const pref = useSyncExternalStore(subscribe, getPref, getPref);
  const resolved = useSyncExternalStore(subscribe, getResolved, getResolved);
  const themes = useSyncExternalStore(subscribe, getThemes, getThemes);
  const controls = useCustomThemeControls(store, subscribe);
  return {
    ...controls,
    pref,
    themes,
    theme: resolved.theme,
    colorScheme: resolved.colorScheme,
    variant: resolved.variant,
    setPref: store?.setPref ?? noop,
  };
}

/** The provider's terminal theme as shown, ready for `xtermTheme(tokens)`. */
export function useTerminalTheme(): ResolvedTerminalTheme & {
  themes: readonly TerminalTheme[];
} & CustomThemeControls {
  const store = useContext(ThemeContext);
  const subscribe = store?.subscribe ?? subscribeNowhere;
  const getTerminal = store?.getTerminal ?? fallbackTerminal;
  // A UI-only store's terminal follows the UI, so its list is the UI's.
  const getThemes = !store
    ? fallbackThemes
    : store.getTerminalThemes().length > 0
      ? store.getTerminalThemes
      : store.getThemes;
  const terminal = useSyncExternalStore(subscribe, getTerminal, getTerminal);
  const themes = useSyncExternalStore(subscribe, getThemes, getThemes);
  const { preview, customThemes, setCustomThemes } = useCustomThemeControls(
    store,
    subscribe,
  );
  return useMemo(
    () => ({ ...terminal, themes, preview, customThemes, setCustomThemes }),
    [terminal, themes, preview, customThemes, setCustomThemes],
  );
}

/**
 * The style the UI is drawn in (a hovered one included), the committed one, the styles the
 * provider's store offers, and a switch that goes through the store's `setPref` (see
 * `ThemeStore.setStyle`). Outside a provider, or under a terminal-only store: the default style
 * alone, and `setStyle` does nothing.
 */
export function useStyle(): {
  style: string;
  committed: string;
  styles: readonly Style[];
  setStyle: (id: string) => void;
} {
  const store = useContext(ThemeContext);
  const ui = store !== null && store.getThemes().length > 0 ? store : null;
  const subscribe = ui?.subscribe ?? subscribeNowhere;
  const getStyle = ui
    ? () => ui.getResolved()?.style ?? ui.getStyle()
    : fallbackStyle;
  const getCommitted = ui?.getStyle ?? fallbackStyle;
  const getStyles = ui?.getStyles ?? fallbackStyles;
  const style = useSyncExternalStore(subscribe, getStyle, getStyle);
  const committed = useSyncExternalStore(subscribe, getCommitted, getCommitted);
  const styles = useSyncExternalStore(subscribe, getStyles, getStyles);
  const setStyle = useCallback(
    (id: string) => {
      if (ui === null) return;
      if (!ui.getStyles().some((s) => s.id === id)) {
        throw new Error(`setStyle: style ${id} is not offered`);
      }
      // setPref rather than setStyle: a wrapper that intercepts commits
      // (Storybook's toolbar) overrides setPref alone.
      ui.setPref(prefForStyle(ui.getPref(), ui.getStyle(), id, ui.getThemes()));
    },
    [ui],
  );
  return { style, committed, styles, setStyle };
}

const OUTSIDE_SLOTS = { ui: true, terminal: false };

/**
 * Which slots the provider's store has, which the two hooks cannot say: each
 * falls back where its slot is missing. Outside a provider: the UI slot only.
 */
export function useThemeSlots(): { ui: boolean; terminal: boolean } {
  const store = useContext(ThemeContext);
  // A store's slots are fixed when it is created.
  return useMemo(
    () =>
      store
        ? {
            ui: store.getThemes().length > 0,
            terminal: store.getTerminalThemes().length > 0,
          }
        : OUTSIDE_SLOTS,
    [store],
  );
}
