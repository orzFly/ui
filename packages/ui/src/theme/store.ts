import { THEMES, type Theme, type ThemePref, themeKind } from "./themes.ts";

const THEME_VALUES = THEMES.map((t) => t.value) as Theme[];
const DARK_QUERY = "(prefers-color-scheme: dark)";

export interface ThemeStoreOptions {
  /** localStorage key holding the pref. Name it after the app; there is no default. */
  storageKey: string;
  /**
   * localStorage key holding the resolved kind, which is what lets the paint
   * guard set `.dark` without knowing which slugs are dark.
   */
  kindStorageKey?: string;
  /** Where `data-theme` and `.dark` are written. */
  root?: HTMLElement;
}

export interface ThemeStore {
  getPref(): ThemePref;
  /** The pref with "system" resolved against the OS. */
  getTheme(): Theme;
  setPref(next: ThemePref): void;
  subscribe(listener: () => void): () => void;
  /** Detaches the media-query and cross-tab listeners. */
  dispose(): void;
}

/**
 * The theme state for one app: the pref, its persistence and the
 * `data-theme`/`.dark` writes. Applies the stored theme as soon as it is
 * created, which is the one side effect importing this package never has.
 *
 * Outside a browser it only remembers the pref, so server rendering and
 * tests can create one.
 */
export function createThemeStore({
  storageKey,
  kindStorageKey = `${storageKey}-kind`,
  root,
}: ThemeStoreOptions): ThemeStore {
  const browser = typeof window !== "undefined";
  const media =
    browser && typeof window.matchMedia === "function"
      ? window.matchMedia(DARK_QUERY)
      : null;
  const target = root ?? (browser ? document.documentElement : null);
  const listeners = new Set<() => void>();

  function readPref(): ThemePref {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === "system" || THEME_VALUES.includes(raw as Theme)) {
        return raw as ThemePref;
      }
    } catch {
      // storage may be unavailable (private mode); fall through
    }
    return "system";
  }

  function resolve(value: ThemePref): Theme {
    if (value !== "system") return value;
    return media?.matches ? "dark" : "light";
  }

  let pref: ThemePref = browser ? readPref() : "system";
  let theme: Theme = resolve(pref);

  function apply() {
    theme = resolve(pref);
    if (target === null) return;
    target.dataset.theme = theme;
    target.classList.toggle("dark", themeKind(theme) === "dark");
  }

  function notify() {
    for (const l of listeners) l();
  }

  const onMediaChange = () => {
    if (pref === "system") {
      apply();
      notify();
    }
  };
  // Keep multiple open tabs in step.
  const onStorage = (e: StorageEvent) => {
    if (e.key === storageKey) {
      pref = readPref();
      apply();
      notify();
    }
  };

  if (browser) {
    apply();
    media?.addEventListener("change", onMediaChange);
    window.addEventListener("storage", onStorage);
  }

  return {
    getPref: () => pref,
    getTheme: () => theme,
    setPref(next) {
      pref = next;
      if (browser) {
        try {
          localStorage.setItem(storageKey, next);
          if (next === "system") {
            localStorage.removeItem(kindStorageKey);
          } else {
            localStorage.setItem(kindStorageKey, themeKind(next));
          }
        } catch {
          // preference just won't persist
        }
      }
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
      listeners.clear();
    },
  };
}
