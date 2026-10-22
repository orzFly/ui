import { builtinThemes, type CustomTheme } from "@orz/themes";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ThemeMenu,
  type ThemeMenuProps,
} from "../src/components/theme-menu.tsx";
import {
  type ThemePref,
  ThemeProvider,
  type ThemeStore,
} from "../src/theme/index.ts";
import {
  ink,
  paper,
  resetThemeEnvironment,
  store,
  stubDarkQuery,
  styleText,
  sunrise,
} from "./theme-helpers.ts";

resetThemeEnvironment();

afterEach(() => {
  vi.useRealTimers();
});

const frappe: CustomTheme = {
  ...sunrise,
  id: "custom-frappe",
  label: "Frappé",
};

interface Setup extends ThemeMenuProps {
  pref?: ThemePref;
  customs?: CustomTheme[];
  options?: Parameters<typeof store>[0];
  dark?: boolean;
}

function setup({
  pref,
  customs,
  options = { terminalThemes: [...builtinThemes, ink, paper] },
  dark = false,
  ...props
}: Setup = {}): ThemeStore {
  stubDarkQuery(dark);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  const themes = store(options);
  if (customs) themes.setCustomThemes(customs);
  if (pref) themes.setPref(pref);
  const view = render(
    <ThemeProvider store={themes}>
      <button type="button">outside</button>
      <ThemeMenu {...props} />
    </ThemeProvider>,
  );
  unmount = view.unmount;
  return themes;
}
let unmount = () => {};

function open(slot: "ui" | "terminal" = "ui") {
  const name = slot === "ui" ? "Theme" : "Terminal theme";
  fireEvent.click(screen.getByRole("button", { name }));
  // Radix registers its outside-pointer listener a tick after opening.
  act(() => vi.advanceTimersByTime(1));
  return screen.getByRole("combobox");
}

function list() {
  return screen.getByRole("listbox", { name: /^(Terminal )?[Tt]hemes$/ });
}

/** The main list's rows, by visible text. */
function rows(): string[] {
  return within(list())
    .queryAllByRole("option")
    .map((el) => el.textContent ?? "");
}

function groups(): string[] {
  return within(list())
    .queryAllByRole("group")
    .map((el) => el.getAttribute("aria-labelledby") ?? "")
    .map((id) => document.getElementById(id)?.textContent ?? "");
}

function highlighted() {
  const id = screen.getByRole("combobox").getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.textContent : undefined;
}

function type(text: string) {
  fireEvent.change(screen.getByRole("combobox"), { target: { value: text } });
}

function key(k: string) {
  fireEvent.keyDown(screen.getByRole("combobox"), { key: k });
}

function row(text: string) {
  const found = within(list())
    .getAllByRole("option")
    .find((el) => el.textContent === text);
  if (!found) throw new Error(`no row ${text}`);
  return found;
}

const settle = () => act(() => vi.advanceTimersByTime(80));

describe("ThemeMenu: filtering", () => {
  it("lists the themes in store order, unfiltered", () => {
    setup();
    open();
    expect(rows()).toEqual(builtinThemes.map((t) => t.label));
  });

  it("matches a theme by its label or a palette's label, and marks the label", () => {
    setup();
    open();
    type("drac");
    expect(rows()).toEqual(["Dracula"]);
    expect(list().querySelector("mark")?.textContent).toBe("Drac");
    type("mocha");
    expect(rows()).toEqual(["Catppuccin · Mocha"]);
    expect(list().querySelector("mark")?.textContent).toBe("Mocha");
  });

  it("takes a keyword from three letters on, so a short query filters by label", () => {
    setup();
    open();
    type("d");
    expect(rows()).not.toContain("Picotera");
    type("dar");
    expect(rows()).toEqual(
      builtinThemes.filter((t) => t.dark).map((t) => t.label),
    );
  });

  it("matches Same as UI by same or follow only", () => {
    setup({ slot: "terminal" });
    open("terminal");
    type("s");
    expect(highlighted()).not.toBe("Same as UI (Default)");
    type("same");
    expect(highlighted()).toBe("Same as UI (Default)");
    type("follow");
    expect(rows()).toEqual(["Same as UI (Default)"]);
  });

  it("matches light and dark against the palettes a theme has", () => {
    setup();
    open();
    type("light");
    expect(rows()).toEqual(
      builtinThemes.filter((t) => t.light).map((t) => t.label),
    );
    expect(rows()).not.toContain("Dracula");
    type("dark");
    expect(rows()).toEqual(
      builtinThemes.filter((t) => t.dark).map((t) => t.label),
    );
  });

  it("matches custom to the Custom group", () => {
    setup({ customs: [sunrise] });
    open();
    expect(groups()).toEqual(["Custom", "Themes"]);
    type("custom");
    expect(groups()).toEqual(["Custom"]);
    expect(rows()).toEqual(["Sunrise"]);
  });

  it("keeps a base theme out of Custom when a stored custom theme had its id", () => {
    localStorage.setItem(
      "app-theme-custom",
      JSON.stringify([sunrise, { ...sunrise, id: "vs", label: "Clash" }]),
    );
    setup();
    open();
    expect(groups()).toEqual(["Custom", "Themes"]);
    expect(rows().slice(0, 2)).toEqual(["Sunrise", "Default"]);
  });

  it("matches terminal to the Terminal only group", () => {
    setup({ slot: "terminal" });
    open("terminal");
    type("terminal");
    expect(groups()).toEqual(["Terminal only"]);
    expect(rows()).toEqual(["Ink", "Paper"]);
  });

  it("shows a variant hit as a flat row when its theme did not match", () => {
    setup();
    open();
    type("amoled");
    expect(rows()).toContain("Catppuccin › AMOLED (dark only)");
    expect(rows()).toContain("Dracula › AMOLED");
    // The best hit is highlighted, so Enter takes it.
    expect(highlighted()).toBe(rows()[0]);
  });

  it("folds diacritics", () => {
    setup({ customs: [frappe] });
    open();
    type("frappe");
    expect(rows()).toEqual(["Frappé"]);
  });

  it("says when nothing matches", () => {
    setup();
    open();
    type("zzz");
    expect(rows()).toEqual([]);
    expect(screen.getByText('No themes match "zzz"')).toBeTruthy();
  });

  it("puts the highlight back on the committed row when the query clears", () => {
    setup({ pref: { ui: { theme: "nord", mode: "dark" } } });
    open();
    expect(highlighted()).toBe("Nord");
    type("sol");
    expect(highlighted()).toBe("Solarized");
    type("");
    expect(highlighted()).toBe("Nord");
  });
});

describe("ThemeMenu: groups per slot", () => {
  it("gives the terminal picker Same as UI, the themes and Terminal only", () => {
    setup({ slot: "terminal", pref: { ui: { theme: "nord", mode: "dark" } } });
    open("terminal");
    expect(rows()[0]).toBe("Same as UI (Nord)");
    expect(groups()).toEqual(["Themes", "Terminal only"]);
    expect(rows().slice(-2)).toEqual(["Ink", "Paper"]);
    expect(highlighted()).toBe("Same as UI (Nord)");
  });

  it("leaves Same as UI out of a terminal-only store", () => {
    setup({
      slot: "terminal",
      options: { themes: undefined, terminalThemes: [ink, ...builtinThemes] },
    });
    open("terminal");
    expect(rows()).not.toContain("Same as UI (Default)");
    expect(rows()[0]).toBe("Default");
  });

  it("leaves Same as UI and Terminal only out of the UI picker", () => {
    setup();
    open();
    expect(groups()).toEqual(["Themes"]);
    expect(rows()).not.toContain("Ink");
  });

  it("renders nothing for a slot the store lacks", () => {
    setup({ slot: "terminal", options: {} });
    expect(screen.queryByRole("button", { name: "Terminal theme" })).toBeNull();
    unmount();
    setup({ options: { themes: undefined, terminalThemes: [ink] } });
    expect(screen.queryByRole("button", { name: "Theme" })).toBeNull();
  });
});

describe("ThemeMenu: preview", () => {
  it("previews the highlighted row once it rests for 80 ms", () => {
    const themes = setup({ pref: { ui: { theme: "vs", mode: "dark" } } });
    open();
    expect(themes.getPreview()).toBeNull();
    key("ArrowDown");
    act(() => vi.advanceTimersByTime(79));
    expect(themes.getPreview()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(themes.getPreview()).toEqual({
      ui: { theme: "github", mode: "dark" },
    });
    expect(themes.getPref().ui?.theme).toBe("vs");
  });

  it("repaints once across a sweep", () => {
    const themes = setup();
    const preview = vi.spyOn(themes, "preview");
    open();
    for (let i = 0; i < 5; i++) {
      key("ArrowDown");
      act(() => vi.advanceTimersByTime(30));
    }
    settle();
    expect(preview).toHaveBeenCalledTimes(1);
  });

  it("reverts 80 ms after the pointer leaves the list", () => {
    const themes = setup();
    open();
    fireEvent.pointerMove(row("Nord"));
    settle();
    expect(themes.getResolved()?.theme.id).toBe("nord");
    fireEvent.pointerLeave(list(), { relatedTarget: document.body });
    act(() => vi.advanceTimersByTime(79));
    expect(themes.getResolved()?.theme.id).toBe("nord");
    act(() => vi.advanceTimersByTime(1));
    expect(themes.getPreview()).toBeNull();
    expect(themes.getResolved()?.theme.id).toBe("default");
  });

  it("reverts at once on Escape, and focuses the trigger", () => {
    const themes = setup();
    open();
    fireEvent.pointerMove(row("Nord"));
    settle();
    key("Escape");
    expect(themes.getPreview()).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("reverts at once on a click outside", () => {
    const themes = setup();
    open();
    fireEvent.pointerMove(row("Monokai"));
    settle();
    const outside = screen.getByRole("button", { name: "outside" });
    // Radix waits for the click that follows a primary-button pointerdown.
    fireEvent.pointerDown(outside);
    fireEvent.click(outside);
    expect(themes.getPreview()).toBeNull();
    expect(themes.getResolved()?.theme.id).toBe("default");
  });

  it("pins a variant's preview to a palette that has it under system", () => {
    const themes = setup({
      pref: { ui: { theme: "catppuccin", mode: "system" } },
    });
    open();
    expect(highlighted()).toBe("Catppuccin");
    key("ArrowRight");
    expect(highlighted()).toBe("Default");
    key("ArrowDown");
    expect(highlighted()).toBe("AMOLED (dark only)");
    settle();
    expect(themes.getPreview()).toEqual({
      ui: { theme: "catppuccin", mode: "dark", variant: "amoled" },
    });
    expect(themes.getResolved()).toMatchObject({
      colorScheme: "dark",
      variant: "amoled",
    });
  });

  it("does not pin by night", () => {
    const themes = setup({
      dark: true,
      pref: { ui: { theme: "catppuccin", mode: "system" } },
    });
    open();
    key("ArrowRight");
    key("ArrowDown");
    settle();
    expect(themes.getPreview()?.ui?.mode).toBe("system");
  });

  it("leaves the UI alone from the terminal picker", () => {
    const themes = setup({ slot: "terminal" });
    const resolved = themes.getResolved();
    open("terminal");
    fireEvent.pointerMove(row("Ink"));
    settle();
    expect(themes.getPreview()).toEqual({
      terminal: { theme: "ink", mode: "system" },
    });
    expect(themes.getTerminal().theme).toBe(ink);
    expect(themes.getResolved()).toBe(resolved);
  });

  it("carries a following terminal along with a UI preview", () => {
    const themes = setup();
    open();
    fireEvent.pointerMove(row("Nord"));
    settle();
    expect(themes.getTerminal()).toMatchObject({
      following: true,
      theme: { id: "nord" },
    });
  });

  it("previews Same as UI as following", () => {
    const themes = setup({
      slot: "terminal",
      pref: {
        ui: { theme: "vs", mode: "light" },
        terminal: { theme: "ink", mode: "dark" },
      },
    });
    open("terminal");
    fireEvent.pointerMove(row("Same as UI (Visual Studio)"));
    settle();
    expect(themes.getPreview()).toEqual({ terminal: "follow" });
    expect(themes.getTerminal().following).toBe(true);
  });

  it("restores the committed style when unmounted mid-preview", () => {
    const themes = setup();
    const committed = styleText();
    open();
    fireEvent.pointerMove(row("Monokai"));
    settle();
    expect(styleText()).not.toBe(committed);
    unmount();
    expect(themes.getPreview()).toBeNull();
    expect(styleText()).toBe(committed);
  });
});

describe("ThemeMenu: what a pick commits", () => {
  it("keeps the mode as stored for a theme row, with no variant", () => {
    const themes = setup({
      pref: { ui: { theme: "catppuccin", mode: "light", variant: "amoled" } },
    });
    open();
    fireEvent.click(row("Solarized"));
    expect(themes.getPref().ui).toEqual({ theme: "solarized", mode: "light" });
    expect(themes.getPreview()).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("carries a mode the store normalized to the next pick", () => {
    const themes = setup({ pref: { ui: { theme: "vs", mode: "system" } } });
    open();
    fireEvent.click(row("Dracula"));
    expect(themes.getPref().ui).toEqual({ theme: "dracula", mode: "dark" });
    open();
    fireEvent.click(row("Solarized"));
    expect(themes.getPref().ui).toEqual({ theme: "solarized", mode: "dark" });
  });

  it("keeps system for a variant one palette has, by Enter", () => {
    const themes = setup({ pref: { ui: { theme: "github", mode: "system" } } });
    open();
    key("ArrowRight");
    key("ArrowDown");
    key("Enter");
    expect(themes.getPref().ui).toEqual({
      theme: "github",
      mode: "system",
      variant: "amoled",
    });
  });

  it("moves a pinned mode to the variant's palette", () => {
    const themes = setup({ pref: { ui: { theme: "github", mode: "light" } } });
    open();
    type("amoled");
    fireEvent.click(row("GitHub › AMOLED (dark only)"));
    expect(themes.getPref().ui).toEqual({
      theme: "github",
      mode: "dark",
      variant: "amoled",
    });
  });

  it("drops the variant for Default in the submenu", () => {
    const themes = setup({
      pref: { ui: { theme: "github", mode: "dark", variant: "amoled" } },
    });
    open();
    key("ArrowRight");
    key("Enter");
    expect(themes.getPref().ui).toEqual({ theme: "github", mode: "dark" });
  });

  it("clears the terminal pick with Same as UI", () => {
    const themes = setup({
      slot: "terminal",
      pref: {
        ui: { theme: "vs", mode: "light" },
        terminal: { theme: "ink", mode: "dark" },
      },
    });
    open("terminal");
    fireEvent.click(row("Same as UI (Visual Studio)"));
    expect(themes.getPref()).toEqual({ ui: { theme: "vs", mode: "light" } });
  });

  it("starts a first terminal pick from the UI's mode", () => {
    const themes = setup({
      slot: "terminal",
      pref: { ui: { theme: "vs", mode: "light" } },
    });
    open("terminal");
    fireEvent.click(row("Solarized"));
    expect(themes.getPref()).toEqual({
      ui: { theme: "vs", mode: "light" },
      terminal: { theme: "solarized", mode: "light" },
    });
  });
});

describe("ThemeMenu: mode switch", () => {
  const mode = (name: string) => screen.getByRole("button", { name });

  it("disables the segments a one-palette theme cannot use, saying why", () => {
    setup({ pref: { ui: { theme: "dracula", mode: "dark" } } });
    open();
    expect(mode("Auto")).toHaveProperty("disabled", true);
    expect(mode("Light")).toHaveProperty("disabled", true);
    expect(mode("Dark")).toHaveProperty("disabled", false);
    expect(mode("Light").title).toBe("Dracula has no light palette");
    expect(mode("Dark").getAttribute("aria-pressed")).toBe("true");
  });

  it("disables all three while the terminal follows", () => {
    setup({ slot: "terminal" });
    open("terminal");
    for (const name of ["Auto", "Light", "Dark"]) {
      expect(mode(name)).toHaveProperty("disabled", true);
      expect(mode(name).title).toBe("Follows the UI theme");
    }
  });

  it("commits at once and leaves no preview pending", () => {
    const themes = setup({ pref: { ui: { theme: "vs", mode: "light" } } });
    const preview = vi.spyOn(themes, "preview");
    open();
    key("ArrowDown");
    fireEvent.click(mode("Dark"));
    expect(themes.getPref().ui).toEqual({ theme: "vs", mode: "dark" });
    expect(highlighted()).toBe("Visual Studio");
    settle();
    expect(preview).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("sets the terminal's own mode", () => {
    const themes = setup({
      slot: "terminal",
      pref: {
        ui: { theme: "vs", mode: "light" },
        terminal: { theme: "solarized", mode: "dark" },
      },
    });
    open("terminal");
    fireEvent.click(mode("Light"));
    expect(themes.getPref().terminal).toEqual({
      theme: "solarized",
      mode: "light",
    });
    expect(themes.getPref().ui).toEqual({ theme: "vs", mode: "light" });
  });
});

describe("ThemeMenu: onCustomize", () => {
  it("has no Custom themes… row and no edit buttons without it", () => {
    setup({ customs: [sunrise] });
    open();
    expect(rows()).not.toContain("Custom themes…");
    expect(screen.queryByRole("button", { name: "Edit Sunrise" })).toBeNull();
  });

  it("opens the editor from the last row, and from a custom row's edit button", () => {
    const onCustomize = vi.fn();
    const themes = setup({ customs: [sunrise], onCustomize });
    open();
    expect(rows().at(-1)).toBe("Custom themes…");
    key("End");
    expect(highlighted()).toBe("Custom themes…");
    key("Enter");
    expect(onCustomize).toHaveBeenLastCalledWith();

    open();
    fireEvent.pointerMove(row("Sunrise"));
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Edit Sunrise" }));
    expect(onCustomize).toHaveBeenLastCalledWith("custom-sunrise");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(themes.getPreview()).toBeNull();
    expect(themes.getPref().ui?.theme).toBe("default");
  });

  it("offers the row in the terminal picker too", () => {
    setup({ slot: "terminal", onCustomize: () => {} });
    open("terminal");
    expect(rows().at(-1)).toBe("Custom themes…");
  });
});
