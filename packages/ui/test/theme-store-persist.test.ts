import { builtinThemes } from "@orz/themes";
import { describe, expect, it, vi } from "vitest";
import {
  html,
  ink,
  paper,
  resetThemeEnvironment,
  store,
  stubDarkQuery,
  styleText,
  sunrise,
} from "./theme-helpers.ts";

resetThemeEnvironment();

const draculaDark = JSON.stringify({ ui: { theme: "dracula", mode: "dark" } });

describe("persistPref: false", () => {
  it("does not read a stored pref", () => {
    stubDarkQuery(false);
    localStorage.setItem("app-theme", draculaDark);
    const themes = store({ persistPref: false });
    expect(themes.getPref()).toEqual({
      ui: { theme: "default", mode: "system" },
    });
    expect(html.dataset.theme).toBe("default");
  });

  it("writes nothing under storageKey on setPref", () => {
    stubDarkQuery(false);
    const set = vi.spyOn(Storage.prototype, "setItem");
    const themes = store({ persistPref: false });
    themes.setPref({ ui: { theme: "nord", mode: "dark" } });
    expect(themes.getPref().ui?.theme).toBe("nord");
    expect(html.dataset.theme).toBe("nord");
    expect(set.mock.calls.map(([key]) => key)).not.toContain("app-theme");
    expect(localStorage.getItem("app-theme")).toBeNull();
  });

  it("still writes the paint cache", () => {
    stubDarkQuery(false);
    const themes = store({ persistPref: false });
    themes.setPref({ ui: { theme: "nord", mode: "dark" } });
    expect(localStorage.getItem("app-theme-paint")).toContain("nord");
  });

  it("ignores another tab's pref", () => {
    stubDarkQuery(false);
    const themes = store({ persistPref: false });
    themes.setPref({ ui: { theme: "nord", mode: "dark" } });
    const pref = themes.getPref();
    const paint = styleText();
    const heard = vi.fn();
    themes.subscribe(heard);
    localStorage.setItem("app-theme", draculaDark);
    window.dispatchEvent(new StorageEvent("storage", { key: "app-theme" }));
    expect(themes.getPref()).toBe(pref);
    expect(styleText()).toBe(paint);
    expect(html.dataset.theme).toBe("nord");
    expect(heard).not.toHaveBeenCalled();
  });

  it.each([
    ["system", { ui: { theme: "solarized", mode: "system" } }],
    ["light", { ui: { theme: "github", mode: "light" } }],
    ["a variant", { ui: { theme: "github", mode: "dark", variant: "amoled" } }],
    ["one palette", { ui: { theme: "dracula", mode: "dark" } }],
    [
      "a terminal pick",
      {
        ui: { theme: "solarized", mode: "system" },
        terminal: { theme: "nord", mode: "dark" },
      },
    ],
  ] as const)("boots on the painted pick under %s", (_, pref) => {
    stubDarkQuery(false);
    const options = { persistPref: false, terminalThemes: builtinThemes };
    store(options).setPref(pref);
    expect(store(options).getPref()).toEqual(pref);
  });

  it("boots on the painted terminal-only pick", () => {
    stubDarkQuery(true);
    const options = {
      persistPref: false,
      themes: undefined,
      terminalThemes: [paper, ink],
    };
    store(options).setPref({ terminal: { theme: "ink", mode: "dark" } });
    expect(store(options).getPref()).toEqual({
      terminal: { theme: "ink", mode: "dark" },
    });
  });

  it("keeps the painted pick through a load that never commits one", () => {
    stubDarkQuery(false);
    store({ persistPref: false }).setPref({
      ui: { theme: "nord", mode: "dark" },
    });
    const paint = localStorage.getItem("app-theme-paint");
    store({ persistPref: false }).dispose();
    expect(localStorage.getItem("app-theme-paint")).toBe(paint);
    expect(store({ persistPref: false }).getPref().ui?.theme).toBe("nord");
    expect(html.dataset.theme).toBe("nord");
  });

  it("boots on the first theme from an unreadable paint cache", () => {
    stubDarkQuery(false);
    localStorage.setItem("app-theme-paint", "{not json");
    expect(store({ persistPref: false }).getPref()).toEqual({
      ui: { theme: "default", mode: "system" },
    });
  });

  it("still follows another tab's custom themes", () => {
    stubDarkQuery(false);
    const themes = store({ persistPref: false });
    localStorage.setItem("app-theme-custom", JSON.stringify([sunrise]));
    window.dispatchEvent(
      new StorageEvent("storage", { key: "app-theme-custom" }),
    );
    expect(themes.getCustomThemes()).toEqual([sunrise]);
    expect(themes.getThemes()[0]?.id).toBe("custom-sunrise");
  });
});
