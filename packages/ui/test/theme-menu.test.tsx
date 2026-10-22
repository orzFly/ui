import { builtinThemes } from "@orz/themes";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeMenu } from "../src/components/theme-menu.tsx";
import {
  createThemeStore,
  ThemeProvider,
  type ThemeStore,
} from "../src/theme/index.ts";

let store: ThemeStore;

afterEach(() => {
  store.dispose();
  localStorage.clear();
});

function renderMenu() {
  store = createThemeStore({
    storageKey: "app-theme",
    themes: builtinThemes,
    terminalThemes: builtinThemes,
  });
  render(
    <ThemeProvider store={store}>
      <ThemeMenu />
    </ThemeProvider>,
  );
}

function openMenu() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Theme" }), {
    button: 0,
    pointerType: "mouse",
  });
}

/** The items carrying the check mark, by their visible label. */
function checked(): string[] {
  return screen
    .getAllByRole("menuitem")
    .filter((item) => item.querySelector(".lucide-check") !== null)
    .map((item) => item.textContent ?? "");
}

describe("ThemeMenu", () => {
  it("lists every palette under its scheme, named by theme and palette", () => {
    renderMenu();
    openMenu();
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
    expect(items).toContain("Solarized Light");
    expect(items).toContain("Solarized Dark");
    expect(items).toContain("Catppuccin Latte");
    expect(items).toContain("Picotera Tera");
    expect(items).toContain("Dracula Dark");
    expect(items).not.toContain("Dracula Light");
    // System, then one row per palette.
    const palettes = builtinThemes.flatMap((t) =>
      [t.light, t.dark].filter(Boolean),
    );
    expect(items).toHaveLength(1 + palettes.length);
  });

  it("sets the UI pick when a row is picked, keeping the terminal pick", () => {
    renderMenu();
    act(() =>
      store.setPref({
        ui: { theme: "default", mode: "system" },
        terminal: { theme: "nord", mode: "dark" },
      }),
    );
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Dracula/ }));
    expect(store.getPref()).toEqual({
      ui: { theme: "dracula", mode: "dark" },
      terminal: { theme: "nord", mode: "dark" },
    });
  });

  it("checks the row matching the UI pick, and follows it", () => {
    renderMenu();
    openMenu();
    expect(checked()).toEqual(["System"]);

    act(() => store.setPref({ ui: { theme: "nord", mode: "dark" } }));
    expect(checked()).toEqual(["Nord Dark"]);

    act(() => store.setPref({ ui: { theme: "solarized", mode: "light" } }));
    expect(checked()).toEqual(["Solarized Light"]);

    // A variant pick is not one of the menu's rows.
    act(() =>
      store.setPref({ ui: { theme: "nord", mode: "dark", variant: "amoled" } }),
    );
    expect(checked()).toEqual([]);
  });
});
