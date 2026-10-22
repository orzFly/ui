import { builtinThemes, type CustomTheme, dracula } from "@orz/themes";
import { describe, expect, it, vi } from "vitest";
import { parseCustomThemes } from "../src/theme/custom.ts";
import {
  html,
  ink,
  inkwell,
  nordTerminal,
  resetThemeEnvironment,
  store,
  stubDarkQuery,
  sunrise,
} from "./theme-helpers.ts";

resetThemeEnvironment();

const ids = (list: readonly { id: string }[]) => list.map((t) => t.id);

describe("parseCustomThemes", () => {
  it.each([null, "", "{not json", "42", '{"id":"x"}', "null"])(
    "reads %j as no themes",
    (raw) => {
      expect(parseCustomThemes(raw)).toEqual([]);
    },
  );

  it("keeps well-formed entries and drops the rest", () => {
    const entries: unknown[] = [
      sunrise,
      { id: "no-label", light: { base: { theme: "vs" } } },
      { id: "no-side", label: "No side" },
      { id: "bad-side", label: "Bad", dark: { base: "nord" } },
      {
        id: "bad-terminal",
        label: "Bad",
        dark: { base: { theme: "nord" }, terminal: 3 },
      },
      {
        id: "own-tokens-no-terminal",
        label: "Own",
        dark: { tokens: { ...dracula.dark?.tokens } },
      },
      inkwell,
      "custom-string",
    ];
    expect(parseCustomThemes(JSON.stringify(entries))).toEqual([
      sunrise,
      inkwell,
    ]);
  });
});

describe("custom themes in the store", () => {
  it("round-trips through storage, under its default key", () => {
    stubDarkQuery(false);
    const first = store();
    first.setCustomThemes([sunrise]);
    expect(JSON.parse(localStorage.getItem("app-theme-custom") ?? "")).toEqual([
      sunrise,
    ]);
    first.dispose();

    const second = store();
    expect(second.getCustomThemes()).toEqual([sunrise]);
    expect(second.getThemes()[0]?.id).toBe("custom-sunrise");
  });

  it("uses the key it was given", () => {
    stubDarkQuery(false);
    store({ customStorageKey: "mine" }).setCustomThemes([sunrise]);
    expect(localStorage.getItem("mine")).not.toBeNull();
    expect(localStorage.getItem("app-theme-custom")).toBeNull();
  });

  it("puts the composed themes ahead of each slot's base list, in stored order", () => {
    stubDarkQuery(false);
    const themes = store({ terminalThemes: [...builtinThemes, ink] });
    const listed = themes.getCustomThemes();
    themes.setCustomThemes([inkwell, sunrise]);
    expect(themes.getCustomThemes()).not.toBe(listed);
    expect(ids(themes.getThemes())).toEqual([
      "custom-inkwell",
      "custom-sunrise",
      ...ids(builtinThemes),
    ]);
    expect(ids(themes.getTerminalThemes())).toEqual([
      "custom-inkwell",
      "custom-sunrise",
      ...ids(builtinThemes),
      "ink",
    ]);
  });

  it("composes a terminal source from a terminal-only theme", () => {
    stubDarkQuery(true);
    const themes = store({ terminalThemes: [...builtinThemes, ink] });
    themes.setCustomThemes([inkwell]);
    themes.setPref({ ui: { theme: "custom-inkwell", mode: "dark" } });
    expect(themes.getTerminal().tokens["terminal-background"]).toBe("#050505");
    expect(themes.getResolved()?.theme.id).toBe("custom-inkwell");
  });

  it("composes in a store without a terminal slot only what its bases allow", () => {
    stubDarkQuery(true);
    const themes = store();
    themes.setCustomThemes([inkwell]);
    themes.setPref({ ui: { theme: "custom-inkwell", mode: "dark" } });
    // ink is not there, so the terminal source falls back to nord's own.
    expect(themes.getTerminal().tokens).toEqual(nordTerminal);
  });

  it("keeps a theme whose bases are gone, out of the lists, and falls the pick back", () => {
    stubDarkQuery(false);
    const themes = store();
    themes.setCustomThemes([inkwell]);
    // No ink in this store, but inkwell's UI side still has nord.
    expect(ids(themes.getThemes())).toContain("custom-inkwell");
    themes.setPref({ ui: { theme: "custom-inkwell", mode: "dark" } });

    themes.setThemes(builtinThemes.filter((t) => t.id !== "nord"));
    expect(themes.getCustomThemes()).toEqual([inkwell]);
    expect(ids(themes.getThemes())).not.toContain("custom-inkwell");
    expect(themes.getPref().ui?.theme).toBe("default");
  });

  it("keeps a user who never picked on the first base theme", () => {
    stubDarkQuery(false);
    const themes = store({
      themes: undefined,
      terminalThemes: [ink, ...builtinThemes],
    });
    const ui = store({ storageKey: "other" });
    themes.setCustomThemes([sunrise]);
    ui.setCustomThemes([sunrise]);
    expect(themes.getPref().terminal?.theme).toBe("ink");
    expect(ui.getPref().ui?.theme).toBe("default");
  });

  it("gives a pick stored before its custom theme arrived its theme back", () => {
    stubDarkQuery(false);
    localStorage.setItem(
      "app-theme",
      JSON.stringify({ ui: { theme: "custom-sunrise", mode: "light" } }),
    );
    const themes = store({ persistCustomThemes: false });
    expect(themes.getPref().ui?.theme).toBe("default");
    themes.setCustomThemes([sunrise]);
    expect(themes.getPref().ui?.theme).toBe("custom-sunrise");
    expect(html.dataset.theme).toBe("custom-sunrise");
  });

  it("paints a stored custom pick on creation", () => {
    stubDarkQuery(false);
    localStorage.setItem("app-theme-custom", JSON.stringify([sunrise]));
    localStorage.setItem(
      "app-theme",
      JSON.stringify({ ui: { theme: "custom-sunrise", mode: "light" } }),
    );
    store();
    expect(html.dataset.theme).toBe("custom-sunrise");
  });

  it("throws on a repeated id, or a base theme's id", () => {
    stubDarkQuery(false);
    const themes = store({ terminalThemes: [...builtinThemes, ink] });
    expect(() => themes.setCustomThemes([sunrise, sunrise])).toThrow(/twice/);
    expect(() =>
      themes.setCustomThemes([{ ...sunrise, id: "dracula" }]),
    ).toThrow(/base/);
    expect(() => themes.setCustomThemes([{ ...sunrise, id: "ink" }])).toThrow(
      /base/,
    );
    expect(themes.getCustomThemes()).toEqual([]);
  });

  it("drops malformed stored entries and leaves the key as it was", () => {
    stubDarkQuery(false);
    const raw = JSON.stringify([
      sunrise,
      { id: "from-the-future", label: "Future", dark: { v2: true } },
    ]);
    localStorage.setItem("app-theme-custom", raw);
    const themes = store();
    expect(themes.getCustomThemes()).toEqual([sunrise]);
    themes.setPref({ ui: { theme: "dracula", mode: "dark" } });
    expect(localStorage.getItem("app-theme-custom")).toBe(raw);
  });

  it("never touches storage for the list with persistCustomThemes: false", () => {
    stubDarkQuery(false);
    localStorage.setItem("app-theme-custom", JSON.stringify([sunrise]));
    const get = vi.spyOn(Storage.prototype, "getItem");
    const set = vi.spyOn(Storage.prototype, "setItem");
    const themes = store({ persistCustomThemes: false });
    expect(themes.getCustomThemes()).toEqual([]);
    themes.setCustomThemes([inkwell]);
    window.dispatchEvent(
      new StorageEvent("storage", { key: "app-theme-custom" }),
    );
    expect(themes.getCustomThemes()).toEqual([inkwell]);
    const keys = [...get.mock.calls, ...set.mock.calls].map(([key]) => key);
    expect(keys).not.toContain("app-theme-custom");
  });

  it("re-reads the list when another tab writes it", () => {
    stubDarkQuery(false);
    const themes = store();
    const heard = vi.fn();
    themes.subscribe(heard);
    localStorage.setItem("app-theme-custom", JSON.stringify([sunrise]));
    window.dispatchEvent(
      new StorageEvent("storage", { key: "app-theme-custom" }),
    );
    expect(themes.getCustomThemes()).toEqual([sunrise]);
    expect(themes.getThemes()[0]?.id).toBe("custom-sunrise");
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("re-composes against a new base list", () => {
    stubDarkQuery(false);
    const themes = store();
    themes.setCustomThemes([sunrise]);
    const before = themes.getThemes()[0];
    const brighter = builtinThemes.map((t) =>
      t.id === "solarized" && t.light
        ? {
            ...t,
            light: {
              ...t.light,
              tokens: { ...t.light.tokens, background: "#ffffff" },
            },
          }
        : t,
    );
    themes.setThemes(brighter);
    const after = themes.getThemes()[0];
    expect(after).not.toBe(before);
    expect(after?.light?.tokens.background).toBe("#ffffff");
    // Its own override still wins.
    expect(after?.light?.tokens.primary).toBe("oklch(0.6 0.18 40)");
  });

  it("returns the same lists until something changes", () => {
    stubDarkQuery(false);
    const themes = store();
    themes.setCustomThemes([sunrise]);
    const list = themes.getThemes();
    const customs = themes.getCustomThemes();
    themes.setPref({ ui: { theme: "vs", mode: "light" } });
    expect(themes.getThemes()).toBe(list);
    expect(themes.getCustomThemes()).toBe(customs);
  });

  it("leaves a stored custom theme out when a base theme has its id", () => {
    stubDarkQuery(false);
    const clash: CustomTheme = { ...sunrise, id: "vs" };
    localStorage.setItem("app-theme-custom", JSON.stringify([clash]));
    const themes = store();
    expect(themes.getCustomThemes()).toEqual([clash]);
    expect(ids(themes.getThemes())).toEqual(ids(builtinThemes));
  });
});
