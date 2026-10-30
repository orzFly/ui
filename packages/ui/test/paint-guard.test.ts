import { builtinThemes, dracula, type TerminalTheme } from "@orz/themes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createThemeStore,
  type ThemePref,
  type ThemeStoreOptions,
  themePaintGuardScript,
} from "../src/theme/index.ts";
import { bothStyles, styledThemes } from "./theme-helpers.ts";

const html = document.documentElement;

const ink: TerminalTheme = {
  id: "ink",
  label: "Ink",
  light: {
    terminal: {
      ...(dracula.dark?.terminal as NonNullable<
        TerminalTheme["light"]
      >["terminal"]),
      "terminal-background": "#fafafa",
    },
  },
  dark: {
    terminal: {
      ...(dracula.dark?.terminal as NonNullable<
        TerminalTheme["dark"]
      >["terminal"]),
      "terminal-background": "#050505",
    },
  },
};

function stubOsDark(matches: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function reset() {
  delete html.dataset.theme;
  delete html.dataset.variant;
  delete html.dataset.style;
  delete html.dataset.terminalTheme;
  html.classList.remove("dark");
  for (const el of document.head.querySelectorAll("style")) el.remove();
}

beforeEach(reset);
afterEach(() => {
  localStorage.clear();
  reset();
  vi.unstubAllGlobals();
});

const ruleText = () =>
  document.head.querySelector("style[data-orz-theme]")?.textContent ?? "";

/**
 * What a paint left on <html>: the value each property ends up with, and the
 * attributes. Values, not text: the guard replays the followed UI palette's
 * terminal tokens before a terminal pick's, where the store writes only the
 * pick's, and the later declaration wins either way.
 */
function snapshot() {
  const text =
    document.head.querySelector("style[data-orz-theme]")?.textContent ?? "";
  const values: Record<string, string> = {};
  const body = text.slice(text.indexOf("{") + 1);
  for (const m of body.matchAll(/([\w-]+):\s*([^;]+);/g)) values[m[1]] = m[2];
  // The guard's alone; "paints the page background" covers it.
  delete values["background-color"];
  return {
    values,
    dark: html.classList.contains("dark"),
    theme: html.dataset.theme,
    variant: html.dataset.variant,
    style: html.dataset.style,
    terminalTheme: html.dataset.terminalTheme,
  };
}

/**
 * Persist `pref` the way the app does under one OS setting, then paint once
 * with the guard and once with a fresh store under another, each from a
 * clean <html>.
 */
function paintBoth(
  slots: Partial<ThemeStoreOptions>,
  pref: ThemePref,
  osDark: boolean,
  writtenUnderDark = !osDark,
) {
  const options = { storageKey: "app-theme", ...slots };
  stubOsDark(writtenUnderDark);
  const writer = createThemeStore(options);
  writer.setPref(pref);
  writer.dispose();

  reset();
  stubOsDark(osDark);
  new Function(themePaintGuardScript(options))();
  const guard = snapshot();

  reset();
  createThemeStore(options).dispose();
  return { guard, store: snapshot() };
}

const ui = { themes: builtinThemes };
const both = { themes: builtinThemes, terminalThemes: [...builtinThemes, ink] };
const terminalOnly = { terminalThemes: [ink] };

describe("themePaintGuardScript", () => {
  it.each([
    ["system", { ui: { theme: "solarized", mode: "system" } }],
    ["light", { ui: { theme: "github", mode: "light" } }],
    ["dark", { ui: { theme: "github", mode: "dark", variant: "amoled" } }],
    ["one-palette", { ui: { theme: "dracula", mode: "dark" } }],
  ] as const)("paints a UI pick under %s the way the store does", (_, pref) => {
    for (const os of [false, true]) {
      const { guard, store } = paintBoth(ui, pref, os);
      expect(guard, `OS dark: ${os}`).toEqual(store);
    }
  });

  it.each([
    ["following", { ui: { theme: "solarized", mode: "system" } }],
    [
      "system",
      {
        ui: { theme: "github", mode: "light" },
        terminal: { theme: "ink", mode: "system" },
      },
    ],
    [
      "pinned",
      {
        ui: { theme: "solarized", mode: "system" },
        terminal: { theme: "dracula", mode: "dark", variant: "amoled" },
      },
    ],
  ] as const)("paints a terminal pick %s the way the store does", (_, pref) => {
    for (const os of [false, true]) {
      const { guard, store } = paintBoth(both, pref, os);
      expect(guard, `OS dark: ${os}`).toEqual(store);
    }
  });

  it.each([
    ["system", { terminal: { theme: "ink", mode: "system" } }],
    ["dark", { terminal: { theme: "ink", mode: "dark" } }],
  ] as const)(
    "paints a terminal-only store under %s the way the store does",
    (_, pref) => {
      for (const os of [false, true]) {
        const { guard, store } = paintBoth(terminalOnly, pref, os);
        expect(guard, `OS dark: ${os}`).toEqual(store);
        expect(guard.dark).toBe(false);
        expect(guard.theme).toBeUndefined();
      }
    },
  );

  it.each([
    [
      "the default style",
      { style: "default", ui: { theme: "solarized", mode: "system" } },
    ],
    [
      "a second style",
      { style: "bevel", ui: { theme: "bevel-day", mode: "system" } },
    ],
  ] as const)("sets data-style for %s the way the store does", (_, pref) => {
    const styled = { themes: styledThemes, styles: bothStyles };
    for (const os of [false, true]) {
      const { guard, store } = paintBoth(styled, pref, os);
      expect(guard, `OS dark: ${os}`).toEqual(store);
      expect(guard.style).toBe(pref.style);
    }
    // The palette's own style tokens are painted with the rest.
    expect(paintBoth(styled, pref, true).guard.values["--3d-face"]).toBe(
      pref.style === "bevel" ? "#404040" : undefined,
    );
  });

  it("paints the page background under a UI pick, where the store does not", () => {
    const options = { storageKey: "app-theme", ...ui };
    stubOsDark(true);
    createThemeStore(options).setPref({ ui: { theme: "nord", mode: "dark" } });
    reset();
    new Function(themePaintGuardScript(options))();
    expect(ruleText()).toContain("background-color: var(--background);");
    createThemeStore(options).dispose();
    expect(ruleText()).not.toContain("background-color");
  });

  it("leaves the page background alone in a terminal-only store", () => {
    const options = { storageKey: "app-theme", ...terminalOnly };
    stubOsDark(true);
    createThemeStore(options).setPref({
      terminal: { theme: "ink", mode: "dark" },
    });
    reset();
    new Function(themePaintGuardScript(options))();
    expect(ruleText()).toContain("--terminal-background");
    expect(ruleText()).not.toContain("background-color");
  });

  it("picks the side from the OS only when both are cached", () => {
    const { guard } = paintBoth(
      ui,
      { ui: { theme: "github", mode: "dark" } },
      false,
    );
    expect(guard.dark).toBe(true);
  });

  it("sets only .dark from a legacy kind key when there is no cache", () => {
    stubOsDark(false);
    localStorage.setItem("app-theme", "dracula");
    localStorage.setItem("app-theme-kind", "dark");
    new Function(themePaintGuardScript({ storageKey: "app-theme" }))();
    expect(html.classList.contains("dark")).toBe(true);
    expect(html.dataset.theme).toBeUndefined();
    expect(document.head.querySelector("style")).toBeNull();
  });

  it("paints nothing with neither a cache nor a kind", () => {
    stubOsDark(true);
    new Function(themePaintGuardScript({ storageKey: "app-theme" }))();
    expect(html.classList.contains("dark")).toBe(false);
    expect(document.head.querySelector("style")).toBeNull();
  });

  it("reads the paint key it was given", () => {
    stubOsDark(false);
    const options = { storageKey: "app-theme", paintKey: "my-paint", ...ui };
    const writer = createThemeStore(options);
    writer.setPref({ ui: { theme: "nord", mode: "dark" } });
    writer.dispose();
    reset();
    new Function(themePaintGuardScript(options))();
    expect(html.dataset.theme).toBe("nord");
  });

  it("cannot be closed early by a key holding </script>", () => {
    const script = themePaintGuardScript({ storageKey: "</script><b>" });
    expect(script).not.toContain("</script>");
    expect(() => new Function(script)()).not.toThrow();
  });
});
