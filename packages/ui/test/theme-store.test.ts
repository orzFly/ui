import {
  builtinThemes,
  dracula,
  github,
  nord,
  resolvePalette,
  solarized,
  type TerminalTheme,
  type Theme,
} from "@orz/themes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createThemeStore,
  normalizePref,
  parseStoredPref,
  type ThemeStore,
} from "../src/theme/index.ts";

/** A `prefers-color-scheme: dark` list the test can flip. */
function stubDarkQuery(initial: boolean) {
  const listeners = new Set<() => void>();
  const list = {
    matches: initial,
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
    listening: () => listeners.size,
  };
}

/** A terminal-only theme: terminal tokens, no UI tokens. */
const ink: TerminalTheme = {
  id: "ink",
  label: "Ink",
  dark: {
    terminal: {
      ...(dracula.dark?.terminal as NonNullable<Theme["dark"]>["terminal"]),
      "terminal-background": "#050505",
    },
  },
};

const html = document.documentElement;
const stores: ThemeStore[] = [];
function store(options: Partial<Parameters<typeof createThemeStore>[0]> = {}) {
  const created = createThemeStore({
    storageKey: "app-theme",
    themes: builtinThemes,
    ...options,
  });
  stores.push(created);
  return created;
}

const styleText = () =>
  document.head.querySelector("style[data-orz-theme]")?.textContent ?? "";
const stored = (key = "app-theme") =>
  JSON.parse(localStorage.getItem(key) ?? "null");

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
});

describe("normalizePref", () => {
  const slots = { themes: builtinThemes };

  it("falls back to the first UI theme under system for an unknown id", () => {
    expect(
      normalizePref({ ui: { theme: "gone", mode: "dark" } }, slots),
    ).toEqual({ ui: { theme: "default", mode: "system" } });
    expect(normalizePref({}, slots)).toEqual({
      ui: { theme: "default", mode: "system" },
    });
  });

  it("pins a one-palette theme's mode to the side it has", () => {
    expect(
      normalizePref({ ui: { theme: "dracula", mode: "system" } }, slots),
    ).toEqual({ ui: { theme: "dracula", mode: "dark" } });
    expect(
      normalizePref({ ui: { theme: "dracula", mode: "light" } }, slots),
    ).toEqual({ ui: { theme: "dracula", mode: "dark" } });
  });

  it("keeps a defined variant and drops an undefined or default one", () => {
    expect(
      normalizePref(
        { ui: { theme: "solarized", mode: "system", variant: "amoled" } },
        slots,
      ),
    ).toEqual({
      ui: { theme: "solarized", mode: "system", variant: "amoled" },
    });
    expect(
      normalizePref(
        { ui: { theme: "solarized", mode: "light", variant: "nope" } },
        slots,
      ),
    ).toEqual({ ui: { theme: "solarized", mode: "light" } });
    expect(
      normalizePref(
        { ui: { theme: "solarized", mode: "light", variant: "default" } },
        slots,
      ),
    ).toEqual({ ui: { theme: "solarized", mode: "light" } });
  });

  it("drops a terminal pick that names no theme, so the terminal follows", () => {
    expect(
      normalizePref(
        {
          ui: { theme: "github", mode: "light" },
          terminal: { theme: "gone", mode: "dark" },
        },
        { themes: builtinThemes, terminalThemes: builtinThemes },
      ),
    ).toEqual({ ui: { theme: "github", mode: "light" } });
  });

  it("gives a terminal-only store a terminal pick always, and no UI pick", () => {
    expect(
      normalizePref(
        {
          ui: { theme: "github", mode: "light" },
          terminal: { theme: "gone", mode: "dark" },
        },
        { terminalThemes: [ink, ...builtinThemes] },
      ),
    ).toEqual({ terminal: { theme: "ink", mode: "dark" } });
  });

  it("drops the terminal pick in a store with no terminal slot", () => {
    expect(
      normalizePref(
        {
          ui: { theme: "github", mode: "light" },
          terminal: { theme: "dracula", mode: "dark" },
        },
        slots,
      ),
    ).toEqual({ ui: { theme: "github", mode: "light" } });
  });
});

describe("parseStoredPref", () => {
  const slots = { themes: builtinThemes };

  it("reads the current JSON shape", () => {
    const pref = {
      ui: { theme: "github", mode: "light" },
      terminal: { theme: "dracula", mode: "dark", variant: "amoled" },
    };
    expect(
      parseStoredPref(JSON.stringify(pref), {
        themes: builtinThemes,
        terminalThemes: builtinThemes,
      }),
    ).toEqual(pref);
  });

  it.each([
    ["solarized-dark", { theme: "solarized", mode: "dark" }],
    ["light", { theme: "default", mode: "light" }],
    ["system", { theme: "default", mode: "system" }],
    ["catppuccin-latte", { theme: "catppuccin", mode: "light" }],
    ["tera-dark", { theme: "picotera", mode: "dark" }],
    ["monokai", { theme: "monokai", mode: "dark" }],
  ])("reads the legacy slug %s", (slug, ui) => {
    expect(parseStoredPref(slug, slots)).toEqual({ ui });
  });

  it("reads a legacy JSON object with a top-level theme", () => {
    expect(
      parseStoredPref(JSON.stringify({ theme: "nord", mode: "dark" }), slots),
    ).toEqual({ ui: { theme: "nord", mode: "dark" } });
  });

  it.each([null, "", "no-such-theme", "{not json", "42", "[]", "constructor"])(
    "falls back on %j",
    (raw) => {
      expect(parseStoredPref(raw, slots)).toEqual({
        ui: { theme: "default", mode: "system" },
      });
    },
  );
});

describe("createThemeStore", () => {
  it("throws without a slot, or with an empty one", () => {
    expect(() => createThemeStore({ storageKey: "k" })).toThrow();
    expect(() => createThemeStore({ storageKey: "k", themes: [] })).toThrow();
    expect(() =>
      createThemeStore({ storageKey: "k", terminalThemes: [] }),
    ).toThrow();
  });

  it("reads the pref from its key and paints it on creation", () => {
    stubDarkQuery(false);
    localStorage.setItem(
      "app-theme",
      JSON.stringify({ ui: { theme: "dracula", mode: "dark" } }),
    );
    const themes = store();
    expect(themes.getPref()).toEqual({
      ui: { theme: "dracula", mode: "dark" },
    });
    expect(themes.getResolved()).toEqual({
      theme: dracula,
      colorScheme: "dark",
      variant: "default",
    });
    expect(html.dataset.theme).toBe("dracula");
    expect(html.dataset.variant).toBeUndefined();
    expect(html.classList.contains("dark")).toBe(true);
    expect(styleText()).toMatch(
      /^:root \{ color-scheme: dark; --diff-addition:/,
    );
    expect(styleText()).toContain(
      `--background: ${dracula.dark?.tokens.background};`,
    );
    expect(styleText()).toContain("--ansi-red: #ff5555;");
  });

  it("reads a legacy slug, and rewrites it in the current shape on the next write", () => {
    stubDarkQuery(false);
    localStorage.setItem("app-theme", "solarized-dark");
    const themes = store();
    expect(themes.getPref()).toEqual({
      ui: { theme: "solarized", mode: "dark" },
    });
    expect(localStorage.getItem("app-theme")).toBe("solarized-dark");
    themes.setPref({ ui: { theme: "solarized", mode: "dark" } });
    expect(stored()).toEqual({ ui: { theme: "solarized", mode: "dark" } });
  });

  it("persists the normalized pref, omitting default variants and a following terminal", () => {
    stubDarkQuery(false);
    const themes = store({ terminalThemes: builtinThemes });
    themes.setPref({
      ui: { theme: "github", mode: "light", variant: "default" },
    });
    expect(stored()).toEqual({ ui: { theme: "github", mode: "light" } });
    themes.setPref({
      ui: { theme: "github", mode: "light" },
      terminal: { theme: "dracula", mode: "system", variant: "amoled" },
    });
    expect(stored()).toEqual({
      ui: { theme: "github", mode: "light" },
      terminal: { theme: "dracula", mode: "dark", variant: "amoled" },
    });
  });

  it("follows the OS under system on a two-palette theme, and only then", () => {
    const os = stubDarkQuery(false);
    const themes = store();
    const heard = vi.fn();
    themes.subscribe(heard);
    themes.setPref({ ui: { theme: "solarized", mode: "system" } });
    heard.mockClear();
    expect(themes.getResolved()?.colorScheme).toBe("light");

    os.set(true);
    expect(themes.getResolved()?.colorScheme).toBe("dark");
    expect(html.classList.contains("dark")).toBe(true);
    expect(styleText()).toContain(
      `--background: ${solarized.dark?.tokens.background};`,
    );
    expect(heard).toHaveBeenCalledTimes(1);

    themes.setPref({ ui: { theme: "solarized", mode: "light" } });
    heard.mockClear();
    const resolved = themes.getResolved();
    os.set(false);
    os.set(true);
    expect(themes.getResolved()).toBe(resolved);
    expect(heard).not.toHaveBeenCalled();
  });

  it("applies the variant to the side that defines it, and default elsewhere", () => {
    const os = stubDarkQuery(false);
    const themes = store();
    themes.setPref({
      ui: { theme: "github", mode: "system", variant: "amoled" },
    });
    expect(themes.getResolved()?.variant).toBe("default");
    expect(html.dataset.variant).toBe("amoled");
    expect(styleText()).toContain(
      `--background: ${github.light?.tokens.background};`,
    );

    os.set(true);
    expect(themes.getResolved()?.variant).toBe("amoled");
    expect(styleText()).toContain("--background: oklch(0 0 0);");
    expect(styleText()).toContain("--terminal-background: #000000;");
  });

  it("keeps the same objects until something changes", () => {
    stubDarkQuery(false);
    const themes = store();
    const pref = themes.getPref();
    const resolved = themes.getResolved();
    const terminal = themes.getTerminal();
    themes.setPref({ ui: { theme: "default", mode: "system" } });
    expect(themes.getPref()).toBe(pref);
    expect(themes.getResolved()).toBe(resolved);
    expect(themes.getTerminal()).toBe(terminal);
    themes.setPref({ ui: { theme: "nord", mode: "dark" } });
    expect(themes.getPref()).not.toBe(pref);
    expect(themes.getResolved()).not.toBe(resolved);
    expect(themes.getTerminal()).not.toBe(terminal);
  });

  describe("slots", () => {
    it("writes the UI pick's terminal tokens in a UI-only store", () => {
      stubDarkQuery(false);
      const themes = store();
      themes.setPref({ ui: { theme: "nord", mode: "dark" } });
      expect(themes.getTerminal()).toEqual({
        following: true,
        theme: nord,
        colorScheme: "dark",
        variant: "default",
        tokens: nord.dark?.terminal,
      });
      expect(themes.getTerminalThemes()).toEqual([]);
      expect(styleText()).toContain(
        `--ansi-red: ${nord.dark?.terminal["ansi-red"]};`,
      );
      expect(html.dataset.terminalTheme).toBeUndefined();
    });

    it("lets the terminal follow the UI pick, variant included", () => {
      stubDarkQuery(false);
      const themes = store({ terminalThemes: builtinThemes });
      themes.setPref({
        ui: { theme: "dracula", mode: "dark", variant: "amoled" },
      });
      const terminal = themes.getTerminal();
      expect(terminal.following).toBe(true);
      expect(terminal.variant).toBe("amoled");
      expect(terminal.tokens["terminal-background"]).toBe("#000000");
    });

    it("gives a terminal pick its own theme and mode under system", () => {
      const os = stubDarkQuery(false);
      const themes = store({ terminalThemes: builtinThemes });
      themes.setPref({
        ui: { theme: "github", mode: "light" },
        terminal: { theme: "solarized", mode: "system" },
      });
      expect(themes.getTerminal()).toMatchObject({
        following: false,
        theme: solarized,
        colorScheme: "light",
      });
      expect(html.dataset.terminalTheme).toBe("solarized");

      os.set(true);
      expect(themes.getResolved()?.colorScheme).toBe("light");
      expect(themes.getTerminal().colorScheme).toBe("dark");
      expect(html.classList.contains("dark")).toBe(false);
      // The terminal's declarations follow the UI's, so they win.
      const text = styleText();
      expect(text).toContain("color-scheme: light;");
      expect(text.lastIndexOf("--terminal-background:")).toBeGreaterThan(
        text.indexOf("--sidebar-ring:"),
      );
      expect(text).toContain(
        `--terminal-background: ${solarized.dark?.terminal["terminal-background"]};`,
      );
    });

    it("reverts an unknown terminal theme to following", () => {
      stubDarkQuery(false);
      const themes = store({ terminalThemes: builtinThemes });
      themes.setPref({
        ui: { theme: "github", mode: "light" },
        terminal: { theme: "gone", mode: "dark" },
      });
      expect(themes.getPref()).toEqual({
        ui: { theme: "github", mode: "light" },
      });
      expect(themes.getTerminal().following).toBe(true);
    });

    it("leaves .dark, color-scheme and data-theme alone in a terminal-only store", () => {
      stubDarkQuery(false);
      const themes = store({ themes: undefined, terminalThemes: [ink] });
      expect(themes.getResolved()).toBeNull();
      expect(themes.getThemes()).toEqual([]);
      expect(themes.getPref()).toEqual({
        terminal: { theme: "ink", mode: "dark" },
      });
      expect(themes.getTerminal()).toMatchObject({
        following: false,
        theme: ink,
        colorScheme: "dark",
      });
      expect(html.classList.contains("dark")).toBe(false);
      expect(html.dataset.theme).toBeUndefined();
      expect(html.dataset.terminalTheme).toBe("ink");
      expect(styleText()).toMatch(/^:root \{ --terminal-background: #050505;/);
      expect(styleText()).not.toContain("color-scheme");
    });
  });

  it("re-reads when another tab writes its key", () => {
    stubDarkQuery(false);
    const themes = store();
    const heard = vi.fn();
    themes.subscribe(heard);

    localStorage.setItem(
      "app-theme",
      JSON.stringify({ ui: { theme: "monokai", mode: "dark" } }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    expect(themes.getPref().ui?.theme).toBe("default");

    window.dispatchEvent(new StorageEvent("storage", { key: "app-theme" }));
    expect(themes.getPref().ui?.theme).toBe("monokai");
    expect(html.dataset.theme).toBe("monokai");
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("re-normalizes when the theme lists change, and restores a pick whose theme returns", () => {
    stubDarkQuery(false);
    const custom: Theme = {
      id: "custom",
      label: "Custom",
      dark: {
        ...(nord.dark as NonNullable<Theme["dark"]>),
        variants: undefined,
      },
    };
    const themes = store({ themes: [...builtinThemes, custom] });
    themes.setPref({ ui: { theme: "custom", mode: "dark" } });
    const heard = vi.fn();
    themes.subscribe(heard);

    themes.setThemes(builtinThemes);
    expect(themes.getPref()).toEqual({
      ui: { theme: "default", mode: "system" },
    });
    expect(heard).toHaveBeenCalledTimes(1);

    themes.setThemes([...builtinThemes, custom]);
    expect(themes.getPref()).toEqual({ ui: { theme: "custom", mode: "dark" } });
    expect(themes.getResolved()?.theme).toBe(custom);
  });

  it("re-normalizes the terminal pick when the terminal list changes", () => {
    stubDarkQuery(false);
    const themes = store({ terminalThemes: [...builtinThemes, ink] });
    themes.setPref({
      ui: { theme: "github", mode: "light" },
      terminal: { theme: "ink", mode: "dark" },
    });
    themes.setTerminalThemes(builtinThemes);
    expect(themes.getTerminal().following).toBe(true);
    expect(() => store().setTerminalThemes(builtinThemes)).toThrow();
    expect(() =>
      store({ themes: undefined, terminalThemes: [ink] }).setThemes(
        builtinThemes,
      ),
    ).toThrow();
  });

  it("lets the first entry win on a duplicate id", () => {
    stubDarkQuery(false);
    const twin: Theme = { ...nord, label: "Twin" };
    const themes = store({ themes: [nord, twin] });
    expect(themes.getThemes()).toEqual([nord]);
  });

  it("stops listening to the OS and other tabs once disposed", () => {
    const os = stubDarkQuery(false);
    const themes = store();
    expect(os.listening()).toBe(1);

    themes.dispose();
    expect(os.listening()).toBe(0);

    localStorage.setItem(
      "app-theme",
      JSON.stringify({ ui: { theme: "nord", mode: "dark" } }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: "app-theme" }));
    expect(themes.getPref().ui?.theme).toBe("default");
  });

  it("paints a given root through its own rule", () => {
    stubDarkQuery(false);
    const root = document.createElement("div");
    const themes = store({ root });
    themes.setPref({ ui: { theme: "tokyo-night", mode: "dark" } });
    expect(root.dataset.theme).toBe("tokyo-night");
    expect(root.hasAttribute("data-orz-theme-root")).toBe(true);
    expect(root.classList.contains("dark")).toBe(true);
    expect(html.dataset.theme).toBeUndefined();
    const own = [...document.head.querySelectorAll("style[data-orz-theme]")];
    expect(own).toHaveLength(1);
    const id = root.getAttribute("data-orz-theme-root");
    expect(
      own[0].textContent?.startsWith(`[data-orz-theme-root="${id}"] { `),
    ).toBe(true);
    themes.dispose();
    expect(document.head.querySelector("style[data-orz-theme]")).toBeNull();
    expect(root.hasAttribute("data-orz-theme-root")).toBe(false);
  });

  it("keeps two stores on their own roots, and one on <html>, apart", () => {
    stubDarkQuery(false);
    const a = document.createElement("div");
    const b = document.createElement("div");
    store({ root: a, storageKey: "a" }).setPref({
      ui: { theme: "nord", mode: "dark" },
    });
    store({ root: b, storageKey: "b" }).setPref({
      ui: { theme: "github", mode: "light" },
    });
    const page = store({ storageKey: "page" });
    const rules = [
      ...document.head.querySelectorAll("style[data-orz-theme]"),
    ].map((el) => el.textContent ?? "");
    expect(rules).toHaveLength(3);
    const ruleFor = (el: HTMLElement) =>
      rules.find((r) =>
        r.startsWith(
          `[data-orz-theme-root="${el.getAttribute("data-orz-theme-root")}"]`,
        ),
      );
    expect(a.getAttribute("data-orz-theme-root")).not.toBe(
      b.getAttribute("data-orz-theme-root"),
    );
    expect(ruleFor(a)).toContain(
      `--background: ${nord.dark?.tokens.background};`,
    );
    expect(ruleFor(b)).toContain(
      `--background: ${github.light?.tokens.background};`,
    );
    // The <html> store made its own element rather than adopting a root's.
    expect(rules.filter((r) => r.startsWith(":root {"))).toHaveLength(1);
    page.setPref({ ui: { theme: "dracula", mode: "dark" } });
    expect(ruleFor(a)).toContain(
      `--background: ${nord.dark?.tokens.background};`,
    );
  });

  it("returns the same empty list for a slot it does not have", () => {
    stubDarkQuery(false);
    const ui = store();
    expect(ui.getTerminalThemes()).toBe(ui.getTerminalThemes());
    const terminal = store({ themes: undefined, terminalThemes: [ink] });
    expect(terminal.getThemes()).toBe(terminal.getThemes());
  });

  describe("a stored pick on a theme that arrives later", () => {
    const custom: Theme = {
      id: "custom",
      label: "Custom",
      dark: {
        ...(nord.dark as NonNullable<Theme["dark"]>),
        variants: undefined,
      },
    };

    it("comes back when setThemes brings the theme", () => {
      stubDarkQuery(false);
      localStorage.setItem(
        "app-theme",
        JSON.stringify({ ui: { theme: "custom", mode: "dark" } }),
      );
      const themes = store();
      expect(themes.getPref().ui?.theme).toBe("default");
      themes.setThemes([...builtinThemes, custom]);
      expect(themes.getPref()).toEqual({
        ui: { theme: "custom", mode: "dark" },
      });
      // Still stored as asked for, so a reload before the list loads keeps it.
      expect(stored()).toEqual({ ui: { theme: "custom", mode: "dark" } });
    });

    it("comes back after another tab wrote it", () => {
      stubDarkQuery(false);
      const themes = store();
      localStorage.setItem(
        "app-theme",
        JSON.stringify({ ui: { theme: "custom", mode: "dark" } }),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: "app-theme" }));
      themes.setThemes([...builtinThemes, custom]);
      expect(themes.getPref().ui?.theme).toBe("custom");
    });

    it("comes back for the terminal when setTerminalThemes brings it", () => {
      stubDarkQuery(false);
      localStorage.setItem(
        "app-theme",
        JSON.stringify({
          ui: { theme: "github", mode: "light" },
          terminal: { theme: "ink", mode: "dark" },
        }),
      );
      const themes = store({ terminalThemes: builtinThemes });
      expect(themes.getTerminal().following).toBe(true);
      themes.setTerminalThemes([...builtinThemes, ink]);
      expect(themes.getTerminal()).toMatchObject({
        following: false,
        theme: ink,
      });
    });
  });

  it("adopts a guard-inserted element instead of adding a second", () => {
    stubDarkQuery(false);
    const guard = document.createElement("style");
    guard.setAttribute("data-orz-theme", "");
    guard.textContent = ":root:root { --background: red; }";
    document.head.append(guard);
    document.head.append(document.createElement("link"));
    store();
    const all = document.head.querySelectorAll("style[data-orz-theme]");
    expect(all).toHaveLength(1);
    expect(all[0]).toBe(guard);
    expect(document.head.lastElementChild).toBe(guard);
    expect(guard.textContent).toContain(
      `--background: ${resolvePalette(builtinThemes[0], "light")?.tokens.background};`,
    );
  });

  it("writes a paint cache holding the sides each slot's mode can show", () => {
    stubDarkQuery(false);
    const themes = store({ terminalThemes: builtinThemes });
    themes.setPref({
      ui: { theme: "github", mode: "system", variant: "amoled" },
      terminal: { theme: "dracula", mode: "dark" },
    });
    const cache = stored("app-theme-paint");
    expect(Object.keys(cache.ui).sort()).toEqual(
      ["dark", "light", "theme", "variant"].sort(),
    );
    expect(cache.ui.variant).toBe("amoled");
    expect(cache.ui.dark).toContain("--background: oklch(0 0 0);");
    expect(cache.ui.light).toContain("--ansi-red: ");
    expect(Object.keys(cache.terminal).sort()).toEqual(["dark", "theme"]);
    expect(cache.terminal.dark).toMatch(/^--terminal-background: /);

    themes.setPref({ ui: { theme: "github", mode: "light" } });
    expect(Object.keys(stored("app-theme-paint"))).toEqual(["ui"]);
    expect(Object.keys(stored("app-theme-paint").ui).sort()).toEqual([
      "light",
      "theme",
    ]);
  });

  it("writes the paint cache under the key it was given", () => {
    stubDarkQuery(false);
    store({ paintKey: "my-paint" });
    expect(stored("my-paint").ui.theme).toBe("default");
  });
});
