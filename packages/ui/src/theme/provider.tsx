import {
  createContext,
  type ReactNode,
  useContext,
  useSyncExternalStore,
} from "react";
import type { ThemeStore } from "./store.ts";
import {
  type Theme,
  type ThemeKind,
  type ThemePref,
  themeKind,
} from "./themes.ts";

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
const systemPref = (): ThemePref => "system";
const lightTheme = (): Theme => "light";

/**
 * The provider's theme. Outside a provider it answers `system`/light and
 * ignores `setPref`, so a primitive rendered on its own still renders.
 */
export function useTheme(): {
  pref: ThemePref;
  theme: Theme;
  kind: ThemeKind;
  setPref: (next: ThemePref) => void;
} {
  const store = useContext(ThemeContext);
  const subscribe = store?.subscribe ?? subscribeNowhere;
  const getPref = store?.getPref ?? systemPref;
  // Read separately from the pref: under "system" an OS switch changes the
  // theme while the pref snapshot stays the same, and would not re-render.
  const getTheme = store?.getTheme ?? lightTheme;
  const pref = useSyncExternalStore(subscribe, getPref, getPref);
  const theme = useSyncExternalStore(subscribe, getTheme, getTheme);
  return {
    pref,
    theme,
    kind: themeKind(theme),
    setPref: store?.setPref ?? noop,
  };
}
