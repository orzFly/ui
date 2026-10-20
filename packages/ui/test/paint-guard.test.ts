import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createThemeStore,
  type ThemePref,
  themePaintGuardScript,
} from "../src/theme/index.ts";

const html = document.documentElement;

function stubOsDark(matches: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function resetHtml() {
  delete html.dataset.theme;
  html.classList.remove("dark");
}

afterEach(() => {
  localStorage.clear();
  resetHtml();
  vi.unstubAllGlobals();
});

/**
 * Persist `pref` the way the app does, then paint once with the guard and
 * once with a fresh store, each onto a clean root.
 */
function paintBoth(pref: ThemePref, osDark: boolean) {
  stubOsDark(osDark);
  const keys = { storageKey: "app-theme", kindStorageKey: "app-kind" };
  const writer = createThemeStore(keys);
  writer.setPref(pref);
  writer.dispose();

  resetHtml();
  new Function(themePaintGuardScript(keys))();
  const guard = {
    theme: html.dataset.theme,
    dark: html.classList.contains("dark"),
  };

  const root = document.createElement("div");
  createThemeStore({ ...keys, root }).dispose();
  const store = {
    theme: root.dataset.theme,
    dark: root.classList.contains("dark"),
  };
  return { guard, store };
}

describe("themePaintGuardScript", () => {
  it.each([
    ["dracula", false],
    ["catppuccin-latte", true],
    ["dark", false],
    ["light", true],
  ] as const)("paints %s the way the store does (OS dark: %s)", (pref, os) => {
    const { guard, store } = paintBoth(pref, os);
    expect(guard).toEqual(store);
  });

  // Under "system" the guard leaves data-theme off while the store writes
  // "light"/"dark". Those two are the defaults with no block of their own, so
  // both paint the same :root / .dark palette; only .dark has to agree.
  it.each([true, false])("agrees on .dark under system (OS dark: %s)", (os) => {
    const { guard, store } = paintBoth("system", os);
    expect(guard.theme).toBeUndefined();
    expect(store.theme).toBe(os ? "dark" : "light");
    expect(guard.dark).toBe(store.dark);
    expect(guard.dark).toBe(os);
  });

  it("cannot be closed early by a key holding </script>", () => {
    const script = themePaintGuardScript({ storageKey: "</script><b>" });
    expect(script).not.toContain("</script>");
    expect(() => new Function(script)()).not.toThrow();
  });
});
