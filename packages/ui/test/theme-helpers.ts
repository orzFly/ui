import {
  builtinThemes,
  type CustomTheme,
  dracula,
  nord,
  type TerminalTheme,
  type TerminalTokens,
} from "@orz/themes";
import { afterEach, beforeEach, vi } from "vitest";
import { createThemeStore, type ThemeStore } from "../src/theme/index.ts";

/** A `prefers-color-scheme: dark` list the test can flip. */
export function stubDarkQuery(initial: boolean) {
  const listeners = new Set<() => void>();
  const list = {
    matches: initial,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_type: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", () => list);
  return {
    set(matches: boolean) {
      list.matches = matches;
      for (const listener of listeners) listener();
    },
  };
}

const draculaTerminal = dracula.dark?.terminal as TerminalTokens;

/** Terminal-only themes: terminal tokens, no UI tokens. */
export const ink: TerminalTheme = {
  id: "ink",
  label: "Ink",
  dark: {
    terminal: { ...draculaTerminal, "terminal-background": "#050505" },
  },
};
export const paper: TerminalTheme = {
  id: "paper",
  label: "Paper",
  light: {
    terminal: { ...draculaTerminal, "terminal-background": "#fafaf5" },
  },
};

/** Based on built-ins, with one override on each side. */
export const sunrise: CustomTheme = {
  id: "custom-sunrise",
  label: "Sunrise",
  light: {
    base: { theme: "solarized" },
    tokens: { primary: "oklch(0.6 0.18 40)" },
  },
  dark: {
    base: { theme: "dracula", variant: "amoled" },
    terminal: { base: { theme: "nord" } },
  },
};
/** Dark only, its terminal based on the terminal-only `ink`. */
export const inkwell: CustomTheme = {
  id: "custom-inkwell",
  label: "Inkwell",
  dark: {
    base: { theme: "nord" },
    terminal: { base: { theme: "ink" } },
  },
};

export const nordTerminal = nord.dark?.terminal as TerminalTokens;

export const html = document.documentElement;
const stores: ThemeStore[] = [];

export function store(
  options: Partial<Parameters<typeof createThemeStore>[0]> = {},
) {
  const created = createThemeStore({
    storageKey: "app-theme",
    themes: builtinThemes,
    ...options,
  });
  stores.push(created);
  return created;
}

export const styleText = () =>
  document.head.querySelector("style[data-orz-theme]")?.textContent ?? "";

/** Clean storage, root and head before each test, and dispose stores after. */
export function resetThemeEnvironment() {
  beforeEach(() => {
    localStorage.clear();
    delete html.dataset.theme;
    delete html.dataset.variant;
    delete html.dataset.terminalTheme;
    html.classList.remove("dark");
    for (const el of document.head.querySelectorAll("style")) el.remove();
  });
  afterEach(() => {
    for (const s of stores.splice(0)) s.dispose();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}
