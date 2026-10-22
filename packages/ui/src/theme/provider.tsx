import type {
  ColorScheme,
  TerminalTheme,
  TerminalTokens,
  Theme,
} from "@orz/themes";
import { defaultTheme } from "@orz/themes/themes/default";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ThemePref } from "./pref.ts";
import type {
  ResolvedTerminalTheme,
  ResolvedTheme,
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
  variant: "default",
};
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

/**
 * The provider's UI theme. Outside a provider it answers the default theme
 * under system, light, and ignores `setPref`, so a primitive rendered on its
 * own still renders.
 */
export function useTheme(): {
  pref: ThemePref;
  themes: readonly Theme[];
  theme: Theme;
  colorScheme: ColorScheme;
  variant: string;
  setPref: (next: ThemePref) => void;
} {
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
  return {
    pref,
    themes,
    theme: resolved.theme,
    colorScheme: resolved.colorScheme,
    variant: resolved.variant,
    setPref: store?.setPref ?? noop,
  };
}

/** The provider's terminal theme, ready for `xtermTheme(tokens)`. */
export function useTerminalTheme(): ResolvedTerminalTheme & {
  themes: readonly TerminalTheme[];
} {
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
  return useMemo(() => ({ ...terminal, themes }), [terminal, themes]);
}
