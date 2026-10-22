import { builtinThemes, composeTheme, dracula, nord } from "@orz/themes";
import { describe, expect, it, vi } from "vitest";
import {
  html,
  ink,
  nordTerminal,
  resetThemeEnvironment,
  store,
  stubDarkQuery,
  styleText,
  sunrise,
} from "./theme-helpers.ts";

resetThemeEnvironment();

const both = () => store({ terminalThemes: [...builtinThemes, ink] });

describe("preview", () => {
  it("shows a UI pick and leaves a terminal with its own pick alone", () => {
    stubDarkQuery(false);
    const themes = both();
    themes.setPref({
      ui: { theme: "vs", mode: "light" },
      terminal: { theme: "ink", mode: "dark" },
    });
    const terminal = themes.getTerminal();
    themes.preview({ ui: { theme: "dracula", mode: "dark" } });
    expect(themes.getResolved()?.theme).toBe(dracula);
    expect(html.dataset.theme).toBe("dracula");
    expect(html.classList.contains("dark")).toBe(true);
    expect(themes.getTerminal()).toBe(terminal);
  });

  it("carries a following terminal along with a UI preview", () => {
    stubDarkQuery(false);
    const themes = both();
    themes.preview({ ui: { theme: "nord", mode: "dark" } });
    expect(themes.getTerminal()).toMatchObject({
      following: true,
      theme: nord,
      tokens: nordTerminal,
    });
  });

  it("shows a terminal pick and leaves the UI alone", () => {
    stubDarkQuery(false);
    const themes = both();
    themes.setPref({ ui: { theme: "vs", mode: "light" } });
    const resolved = themes.getResolved();
    themes.preview({ terminal: { theme: "ink", mode: "dark" } });
    expect(themes.getResolved()).toBe(resolved);
    expect(themes.getTerminal()).toMatchObject({
      following: false,
      theme: ink,
    });
    expect(html.dataset.terminalTheme).toBe("ink");
    expect(html.dataset.theme).toBe("vs");
  });

  it('previews the terminal following the UI with "follow"', () => {
    stubDarkQuery(false);
    const themes = both();
    themes.setPref({
      ui: { theme: "vs", mode: "light" },
      terminal: { theme: "ink", mode: "dark" },
    });
    themes.preview({ terminal: "follow" });
    expect(themes.getTerminal()).toMatchObject({ following: true });
    expect(html.dataset.terminalTheme).toBeUndefined();
    expect(themes.getPref().terminal?.theme).toBe("ink");
  });

  it("shows an unsaved theme carried as an object", () => {
    stubDarkQuery(false);
    const themes = both();
    const draft = composeTheme(
      { ...sunrise, id: "custom-draft" },
      builtinThemes,
    );
    if (draft === null) throw new Error("draft did not compose");
    themes.preview({ ui: { theme: draft, mode: "dark" } });
    expect(themes.getResolved()).toMatchObject({
      theme: draft,
      colorScheme: "dark",
    });
    expect(html.dataset.theme).toBe("custom-draft");
    expect(themes.getThemes()).not.toContain(draft);
  });

  it("throws for a terminal-only object in the UI slot", () => {
    stubDarkQuery(false);
    const themes = both();
    expect(() => themes.preview({ ui: { theme: ink, mode: "dark" } })).toThrow(
      /not a UI theme/,
    );
    expect(themes.getPreview()).toBeNull();
  });

  it("changes what is shown, never the pref", () => {
    stubDarkQuery(false);
    const themes = both();
    const pref = themes.getPref();
    const next = { ui: { theme: "monokai", mode: "dark" as const } };
    themes.preview(next);
    expect(themes.getPref()).toBe(pref);
    expect(themes.getPreview()).toBe(next);
    expect(themes.getResolved()?.theme.id).toBe("monokai");
  });

  it("writes neither the pref nor the paint cache", () => {
    stubDarkQuery(false);
    const themes = both();
    const set = vi.spyOn(Storage.prototype, "setItem");
    themes.preview({ ui: { theme: "monokai", mode: "dark" } });
    themes.preview({ terminal: { theme: "ink", mode: "dark" } });
    themes.preview(null);
    expect(set).not.toHaveBeenCalled();
  });

  it("fits a previewed pick to its theme", () => {
    stubDarkQuery(false);
    const themes = both();
    themes.preview({
      ui: { theme: "dracula", mode: "light", variant: "nope" },
    });
    expect(themes.getResolved()).toMatchObject({
      colorScheme: "dark",
      variant: "default",
    });
    expect(html.dataset.variant).toBeUndefined();
    themes.preview({
      ui: { theme: "dracula", mode: "dark", variant: "amoled" },
    });
    expect(html.dataset.variant).toBe("amoled");
  });

  it("is cleared by setPref", () => {
    stubDarkQuery(false);
    const themes = both();
    themes.preview({ ui: { theme: "monokai", mode: "dark" } });
    themes.setPref({ ui: { theme: "vs", mode: "light" } });
    expect(themes.getPreview()).toBeNull();
    expect(themes.getResolved()?.theme.id).toBe("vs");
  });

  it("is cleared by dispose, which paints the committed pick back", () => {
    stubDarkQuery(false);
    const themes = both();
    const committed = styleText();
    themes.preview({ ui: { theme: "monokai", mode: "dark" } });
    themes.dispose();
    expect(themes.getPreview()).toBeNull();
    expect(styleText()).toBe(committed);
  });

  it("falls back to the committed pick when the previewed theme leaves the list", () => {
    stubDarkQuery(false);
    const themes = both();
    themes.preview({
      ui: { theme: "monokai", mode: "dark" },
      terminal: { theme: "ink", mode: "dark" },
    });
    themes.setThemes(builtinThemes.filter((t) => t.id !== "monokai"));
    expect(themes.getResolved()?.theme.id).toBe("default");
    themes.setTerminalThemes(builtinThemes);
    expect(themes.getTerminal().following).toBe(true);
  });

  it("keeps showing through a pick from another tab, then shows that pick", () => {
    stubDarkQuery(false);
    const themes = both();
    themes.preview({ ui: { theme: "monokai", mode: "dark" } });
    localStorage.setItem(
      "app-theme",
      JSON.stringify({ ui: { theme: "nord", mode: "dark" } }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: "app-theme" }));
    expect(themes.getPref().ui?.theme).toBe("nord");
    expect(themes.getResolved()?.theme.id).toBe("monokai");
    themes.preview(null);
    expect(themes.getResolved()?.theme.id).toBe("nord");
  });

  it("restores the committed style text exactly on null", () => {
    stubDarkQuery(true);
    const themes = both();
    themes.setPref({
      ui: { theme: "catppuccin", mode: "system", variant: "amoled" },
      terminal: { theme: "ink", mode: "dark" },
    });
    const committed = styleText();
    const attrs = { ...html.dataset };
    themes.preview({
      ui: { theme: "vs", mode: "light" },
      terminal: "follow",
    });
    expect(styleText()).not.toBe(committed);
    themes.preview(null);
    expect(styleText()).toBe(committed);
    expect({ ...html.dataset }).toEqual(attrs);
    expect(html.classList.contains("dark")).toBe(true);
  });

  it("follows the OS under a previewed system mode", () => {
    const os = stubDarkQuery(false);
    const themes = both();
    themes.setPref({ ui: { theme: "monokai", mode: "dark" } });
    themes.preview({ ui: { theme: "github", mode: "system" } });
    expect(themes.getResolved()?.colorScheme).toBe("light");
    os.set(true);
    expect(themes.getResolved()?.colorScheme).toBe("dark");
  });

  it("notifies on a change only", () => {
    stubDarkQuery(false);
    const themes = both();
    const heard = vi.fn();
    themes.subscribe(heard);
    themes.preview(null);
    expect(heard).not.toHaveBeenCalled();
    themes.preview({ ui: { theme: "monokai", mode: "dark" } });
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
