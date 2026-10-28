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
import { loadPierre } from "../src/syntax-registry.ts";

const registerCustomTheme = vi.hoisted(() => vi.fn());
vi.mock("@pierre/diffs", () => ({ registerCustomTheme }));

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

describe("a palette's own syntax theme", () => {
  const names = () => registerCustomTheme.mock.calls.map(([name]) => name);

  it("is handed to pierre by name and registered once", async () => {
    stubOsDark(false);
    createStore().setPref({ ui: { theme: "pro-sakura", mode: "system" } });
    const { result, rerender } = renderHook(() => useSyntaxTheme(), {
      wrapper,
    });
    expect(result.current).toEqual({
      light: "orz-pro-sakura-light",
      dark: "orz-pro-sakura-dark",
    });
    // Picked before pierre loaded: queued, then registered by the loader.
    expect(names()).toEqual([]);
    await loadPierre();
    expect(names()).toEqual(["orz-pro-sakura-light", "orz-pro-sakura-dark"]);
    const [, load] = registerCustomTheme.mock.calls[0];
    await expect(load()).resolves.toMatchObject({
      name: "orz-pro-sakura-light",
      type: "light",
    });

    act(() => store.setPref({ ui: { theme: "pro-sakura", mode: "dark" } }));
    rerender();
    act(() =>
      store.setPref({
        ui: { theme: "pro-sakura", mode: "dark", variant: "amoled" },
      }),
    );
    expect(result.current.dark).toBe("orz-pro-sakura-dark");
    expect(names()).toHaveLength(2);

    // Picked after pierre loaded: registered at once.
    act(() => store.setPref({ ui: { theme: "pro-lagoon", mode: "light" } }));
    expect(result.current.light).toBe("orz-pro-lagoon-light");
    expect(names()).toEqual([
      "orz-pro-sakura-light",
      "orz-pro-sakura-dark",
      "orz-pro-lagoon-light",
    ]);
  });

  it("is not involved for a bundled name", () => {
    registerCustomTheme.mockClear();
    stubOsDark(false);
    createStore().setPref({ ui: { theme: "solarized", mode: "system" } });
    renderHook(() => useSyntaxTheme(), { wrapper });
    expect(names()).toEqual([]);
  });
});
