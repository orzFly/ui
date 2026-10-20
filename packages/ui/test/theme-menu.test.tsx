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
  store = createThemeStore({ storageKey: "app-theme" });
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
  it("sets the store's pref when an item is picked", () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Dracula/ }));
    expect(store.getPref()).toBe("dracula");
  });

  it("checks the item matching the pref, and follows it", () => {
    renderMenu();
    openMenu();
    expect(checked()).toEqual(["System"]);

    act(() => store.setPref("nord"));
    expect(checked()).toEqual(["Nord"]);
  });
});
