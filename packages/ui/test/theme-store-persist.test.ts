import { describe, expect, it, vi } from "vitest";
import {
  html,
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
