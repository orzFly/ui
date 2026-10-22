import { builtinThemes } from "@orz/themes";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  ThemeProvider,
  type ThemeStore,
  useTerminalTheme,
  useTheme,
  useThemeSlots,
} from "../src/theme/index.ts";
import {
  ink,
  resetThemeEnvironment,
  store,
  stubDarkQuery,
  sunrise,
} from "./theme-helpers.ts";

resetThemeEnvironment();

const within = (themes: ThemeStore) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <ThemeProvider store={themes}>{children}</ThemeProvider>;
  };

describe("useTheme and useTerminalTheme: preview and custom themes", () => {
  it("answers an empty list and ignores the calls outside a provider", () => {
    const ui = renderHook(() => useTheme()).result.current;
    const terminal = renderHook(() => useTerminalTheme()).result.current;
    for (const hook of [ui, terminal]) {
      expect(hook.customThemes).toEqual([]);
      expect(() => {
        hook.preview({ ui: { theme: "dracula", mode: "dark" } });
        hook.setCustomThemes([sunrise]);
      }).not.toThrow();
    }
  });

  it("reaches the store's preview, list and setter inside one", () => {
    stubDarkQuery(false);
    const themes = store({ terminalThemes: [...builtinThemes, ink] });
    const { result } = renderHook(
      () => ({ ui: useTheme(), terminal: useTerminalTheme() }),
      { wrapper: within(themes) },
    );

    act(() => result.current.ui.setCustomThemes([sunrise]));
    expect(themes.getCustomThemes()).toEqual([sunrise]);
    expect(result.current.ui.customThemes).toEqual([sunrise]);
    expect(result.current.terminal.customThemes).toEqual([sunrise]);
    expect(result.current.ui.themes[0]?.id).toBe("custom-sunrise");

    act(() =>
      result.current.terminal.preview({
        ui: { theme: "monokai", mode: "dark" },
        terminal: { theme: "ink", mode: "dark" },
      }),
    );
    expect(result.current.ui.theme.id).toBe("monokai");
    expect(result.current.ui.pref.ui?.theme).toBe("default");
    expect(result.current.terminal.theme).toBe(ink);

    act(() => result.current.ui.preview(null));
    expect(result.current.ui.theme.id).toBe("default");
  });

  it("re-renders a reader of customThemes after setCustomThemes", () => {
    stubDarkQuery(false);
    const themes = store();
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders++;
        return useTheme().customThemes;
      },
      { wrapper: within(themes) },
    );
    const before = renders;
    act(() => themes.setCustomThemes([sunrise]));
    expect(renders).toBeGreaterThan(before);
    expect(result.current).toEqual([sunrise]);
  });

  it("keeps useTerminalTheme's object until an input changes", () => {
    stubDarkQuery(false);
    const themes = store({ terminalThemes: [...builtinThemes, ink] });
    const { result, rerender } = renderHook(() => useTerminalTheme(), {
      wrapper: within(themes),
    });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    act(() => themes.setCustomThemes([sunrise]));
    expect(result.current).not.toBe(first);
  });
});

describe("useThemeSlots", () => {
  it("says UI only outside a provider", () => {
    expect(renderHook(() => useThemeSlots()).result.current).toEqual({
      ui: true,
      terminal: false,
    });
  });

  it.each([
    ["a UI-only store", {}, { ui: true, terminal: false }],
    [
      "a terminal-only store",
      { themes: undefined, terminalThemes: [ink] },
      { ui: false, terminal: true },
    ],
    [
      "a store with both",
      { terminalThemes: [...builtinThemes, ink] },
      { ui: true, terminal: true },
    ],
  ])("reads %s", (_name, options, slots) => {
    stubDarkQuery(false);
    const themes = store(options);
    const { result } = renderHook(() => useThemeSlots(), {
      wrapper: within(themes),
    });
    expect(result.current).toEqual(slots);
  });
});
