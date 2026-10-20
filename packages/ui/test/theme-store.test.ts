import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createThemeStore, type ThemeStore } from "../src/theme/index.ts";

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

const html = document.documentElement;
const stores: ThemeStore[] = [];
function store(options: Parameters<typeof createThemeStore>[0]) {
  const created = createThemeStore(options);
  stores.push(created);
  return created;
}

beforeEach(() => {
  localStorage.clear();
  delete html.dataset.theme;
  html.classList.remove("dark");
});

afterEach(() => {
  for (const s of stores.splice(0)) s.dispose();
  vi.unstubAllGlobals();
});

describe("createThemeStore", () => {
  it("reads the pref from the key it was given and applies it on creation", () => {
    stubDarkQuery(false);
    localStorage.setItem("app-theme", "dracula");
    const themes = store({ storageKey: "app-theme" });
    expect(themes.getPref()).toBe("dracula");
    expect(html.dataset.theme).toBe("dracula");
    expect(html.classList.contains("dark")).toBe(true);
  });

  it("ignores a stored value that names no theme", () => {
    stubDarkQuery(false);
    localStorage.setItem("app-theme", "no-such-theme");
    expect(store({ storageKey: "app-theme" }).getPref()).toBe("system");
  });

  it("writes the pref and its kind, and drops the kind for system", () => {
    stubDarkQuery(false);
    const themes = store({
      storageKey: "app-theme",
      kindStorageKey: "app-kind",
    });

    themes.setPref("nord");
    expect(localStorage.getItem("app-theme")).toBe("nord");
    expect(localStorage.getItem("app-kind")).toBe("dark");

    themes.setPref("catppuccin-latte");
    expect(localStorage.getItem("app-kind")).toBe("light");
    expect(html.classList.contains("dark")).toBe(false);

    themes.setPref("system");
    expect(localStorage.getItem("app-theme")).toBe("system");
    expect(localStorage.getItem("app-kind")).toBeNull();
  });

  it("derives the kind key from the storage key by default", () => {
    stubDarkQuery(false);
    store({ storageKey: "app-theme" }).setPref("dark");
    expect(localStorage.getItem("app-theme-kind")).toBe("dark");
  });

  it("follows the OS under system, and only under system", () => {
    const os = stubDarkQuery(false);
    const themes = store({ storageKey: "app-theme" });
    const heard = vi.fn();
    themes.subscribe(heard);
    expect(themes.getTheme()).toBe("light");

    os.set(true);
    expect(themes.getTheme()).toBe("dark");
    expect(html.dataset.theme).toBe("dark");
    expect(html.classList.contains("dark")).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);

    themes.setPref("solarized-light");
    heard.mockClear();
    os.set(false);
    os.set(true);
    expect(themes.getTheme()).toBe("solarized-light");
    expect(heard).not.toHaveBeenCalled();
  });

  it("re-reads when another tab writes its key", () => {
    stubDarkQuery(false);
    const themes = store({ storageKey: "app-theme" });
    const heard = vi.fn();
    themes.subscribe(heard);

    localStorage.setItem("app-theme", "monokai");
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    expect(themes.getPref()).toBe("system");

    window.dispatchEvent(new StorageEvent("storage", { key: "app-theme" }));
    expect(themes.getPref()).toBe("monokai");
    expect(html.dataset.theme).toBe("monokai");
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("stops listening to the OS and other tabs once disposed", () => {
    const os = stubDarkQuery(false);
    const themes = store({ storageKey: "app-theme" });
    expect(os.listening()).toBe(1);

    themes.dispose();
    expect(os.listening()).toBe(0);

    localStorage.setItem("app-theme", "nord");
    window.dispatchEvent(new StorageEvent("storage", { key: "app-theme" }));
    expect(themes.getPref()).toBe("system");
  });

  it("writes data-theme and .dark onto the root it was given", () => {
    stubDarkQuery(false);
    const root = document.createElement("div");
    store({ storageKey: "app-theme", root }).setPref("tokyo-night");
    expect(root.dataset.theme).toBe("tokyo-night");
    expect(root.classList.contains("dark")).toBe(true);
    expect(html.dataset.theme).toBeUndefined();
  });
});
