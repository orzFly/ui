import { builtinThemes, dracula, type Theme } from "@orz/themes";
import {
  createThemeStore,
  ThemeProvider,
  type ThemeStore,
} from "@orz/ui/theme";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PIERRE_THEME, useSyntaxTheme } from "../src/code-block.tsx";

let store: ThemeStore;

function stubOsDark(matches: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function createStore(themes: readonly Theme[] = builtinThemes) {
  store = createThemeStore({ storageKey: "app-theme", themes });
  return store;
}

afterEach(() => {
  store?.dispose();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider store={store}>{children}</ThemeProvider>;
}

describe("useSyntaxTheme", () => {
  it("keeps pierre's own pair outside any ThemeProvider", () => {
    const { result } = renderHook(() => useSyntaxTheme());
    expect(result.current).toBe(PIERRE_THEME);
  });

  it("keeps pierre's own pair for the default theme under system", () => {
    createStore();
    const { result } = renderHook(() => useSyntaxTheme(), { wrapper });
    expect(result.current).toBe(PIERRE_THEME);
  });

  it("fills each slot from its own palette under system", () => {
    stubOsDark(false);
    createStore().setPref({ ui: { theme: "solarized", mode: "system" } });
    const { result } = renderHook(() => useSyntaxTheme(), { wrapper });
    expect(result.current).toEqual({
      light: "solarized-light",
      dark: "solarized-dark",
    });
  });

  it("fills both slots from the side on screen under a pinned mode", () => {
    stubOsDark(false);
    createStore().setPref({ ui: { theme: "solarized", mode: "dark" } });
    const { result } = renderHook(() => useSyntaxTheme(), { wrapper });
    expect(result.current).toEqual({
      light: "solarized-dark",
      dark: "solarized-dark",
    });
  });

  it("fills both slots from a one-palette theme", () => {
    createStore().setPref({ ui: { theme: "dracula", mode: "dark" } });
    const { result } = renderHook(() => useSyntaxTheme(), { wrapper });
    expect(result.current).toEqual({ light: "dracula", dark: "dracula" });
  });

  it("falls back to pierre per slot for a palette with no shiki theme", () => {
    createStore().setPref({ ui: { theme: "picotera", mode: "system" } });
    const { result } = renderHook(() => useSyntaxTheme(), { wrapper });
    expect(result.current).toBe(PIERRE_THEME);

    const half: Theme = {
      id: "half",
      label: "Half",
      light: {
        ...(dracula.dark as NonNullable<Theme["dark"]>),
        syntax: undefined,
      },
      dark: dracula.dark as NonNullable<Theme["dark"]>,
    };
    act(() => store.setThemes([half]));
    act(() => store.setPref({ ui: { theme: "half", mode: "system" } }));
    expect(result.current).toEqual({
      light: PIERRE_THEME.light,
      dark: "dracula",
    });
  });

  it("takes a variant's syntax over its palette's", () => {
    const tinted: Theme = {
      id: "tinted",
      label: "Tinted",
      dark: {
        ...(dracula.dark as NonNullable<Theme["dark"]>),
        variants: {
          amoled: { label: "AMOLED", syntax: "dracula-soft" },
        },
      },
    };
    createStore([tinted]).setPref({
      ui: { theme: "tinted", mode: "dark", variant: "amoled" },
    });
    const { result } = renderHook(() => useSyntaxTheme(), { wrapper });
    expect(result.current).toEqual({
      light: "dracula-soft",
      dark: "dracula-soft",
    });
  });

  it("returns one object per pair, so pierre sees stable options", () => {
    createStore().setPref({ ui: { theme: "dracula", mode: "dark" } });
    const first = renderHook(() => useSyntaxTheme(), { wrapper });
    const second = renderHook(() => useSyntaxTheme(), { wrapper });
    expect(first.result.current).toBe(second.result.current);
    first.rerender();
    expect(first.result.current).toBe(second.result.current);
    // AMOLED Dracula has no syntax of its own, so it is the same pair.
    act(() =>
      store.setPref({
        ui: { theme: "dracula", mode: "dark", variant: "amoled" },
      }),
    );
    expect(first.result.current).toBe(second.result.current);
  });

  it("hands out a different object when the pair changes", () => {
    createStore().setPref({ ui: { theme: "nord", mode: "dark" } });
    const { result } = renderHook(() => useSyntaxTheme(), { wrapper });
    const nord = result.current;
    act(() => store.setPref({ ui: { theme: "monokai", mode: "dark" } }));
    expect(result.current).not.toBe(nord);
    expect(result.current.light).toBe("monokai");
  });
});
