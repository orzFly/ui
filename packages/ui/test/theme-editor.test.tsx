import { builtinThemes, type CustomTheme, type Theme } from "@orz/themes";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ThemeEditor } from "../src/components/theme-editor.tsx";
import { hasUnsavedWork } from "../src/lib/unsaved-guard.ts";
import {
  type ThemePref,
  ThemeProvider,
  type ThemeStore,
} from "../src/theme/index.ts";
import {
  ink,
  inkwell,
  paper,
  resetThemeEnvironment,
  store,
  stubDarkQuery,
  sunrise,
} from "./theme-helpers.ts";

resetThemeEnvironment();

const PICKED = "oklch(0.9 0.02 90)";

/** Fully custom on both sides, so it composes without any base. */
const solarized = builtinThemes.find((t) => t.id === "solarized") as Theme;
const detached: CustomTheme = {
  id: "custom-paper-ink",
  label: "Paper & Ink",
  light: {
    tokens: { ...solarized.light?.tokens },
    terminal: { tokens: { ...solarized.light?.terminal } },
  } as CustomTheme["light"],
};

interface Setup {
  customs?: CustomTheme[];
  pref?: ThemePref;
  themeId?: string;
  options?: Parameters<typeof store>[0];
  dark?: boolean;
}

function setup({ customs, pref, themeId, options, dark = false }: Setup = {}) {
  stubDarkQuery(dark);
  const themes = store(options);
  if (customs) themes.setCustomThemes(customs);
  if (pref) themes.setPref(pref);
  const onOpenChange = vi.fn();
  function App({ id }: { id?: string }) {
    const [open, setOpen] = useState(true);
    return (
      <ThemeProvider store={themes}>
        <button type="button" onClick={() => setOpen(true)}>
          reopen
        </button>
        <ThemeEditor
          open={open}
          themeId={id}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
        />
      </ThemeProvider>
    );
  }
  const view = render(<App id={themeId} />);
  return {
    themes,
    onOpenChange,
    rerender: (id?: string) => view.rerender(<App id={id} />),
  };
}

const nameField = () => screen.getByRole("textbox", { name: "Name" });
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const tab = (label: string) =>
  screen.getByRole("tab", { name: new RegExp(`^${label}`) });
const showTab = (label: string) => fireEvent.mouseDown(tab(label));
const radio = (group: string, name: string) =>
  within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", {
    name,
  });
const rename = (label: string) =>
  fireEvent.change(nameField(), { target: { value: label } });
const unsavedPrompt = () =>
  screen.queryByRole("dialog", { name: "Leave with unsaved changes?" });

function choose(combobox: string, option: string | RegExp) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: combobox }), {
    key: "Enter",
  });
  fireEvent.click(screen.getByRole("option", { name: option }));
}

function themeOptions() {
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Custom theme" }), {
    key: "Enter",
  });
  const options = screen.getAllByRole("option");
  return options;
}

function pick(token: string, value: string) {
  const trigger = screen.getByRole("button", {
    name: new RegExp(`\\(${token}\\)$`),
  });
  fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
  fireEvent.click(trigger);
  const field = screen.getByRole("textbox", { name: "Colour value" });
  fireEvent.change(field, { target: { value } });
  return field;
}

/** The theme the store previews on the UI slot, and its mode. */
function previewed(themes: ThemeStore) {
  const ui = themes.getPreview()?.ui;
  if (ui === undefined || typeof ui.theme === "string") return null;
  return { theme: ui.theme as Theme, mode: ui.mode };
}

describe("ThemeEditor: opening", () => {
  it("renders nothing in a store without a UI slot", () => {
    setup({ options: { themes: undefined, terminalThemes: [ink, paper] } });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the theme it is given", () => {
    setup({ customs: [sunrise, inkwell], themeId: "custom-inkwell" });
    expect(screen.getByRole("dialog", { name: "Custom themes" })).toBeTruthy();
    expect((nameField() as HTMLInputElement).value).toBe("Inkwell");
    expect(
      screen.getByRole("combobox", { name: "Custom theme" }).textContent,
    ).toContain("Inkwell");
  });

  it("starts a new theme from the page's pick without an id", () => {
    const { themes } = setup({
      customs: [sunrise],
      pref: { ui: { theme: "dracula", mode: "dark", variant: "amoled" } },
    });
    expect((nameField() as HTMLInputElement).value).toBe("Custom theme");
    expect(tab("Light").textContent).toContain("None");
    expect(tab("Dark").textContent).toContain("Dracula");
    fireEvent.click(button("Save"));
    const saved = themes.getCustomThemes()[1];
    expect(saved?.id).toMatch(/^custom-[0-9a-z]{8}$/);
    expect(saved).toMatchObject({
      label: "Custom theme",
      dark: { base: { theme: "dracula", variant: "amoled" } },
    });
    expect(saved?.light).toBeUndefined();
  });

  it("starts a new theme for an id the store does not hold", () => {
    setup({ customs: [sunrise], themeId: "custom-gone" });
    expect((nameField() as HTMLInputElement).value).toBe("Custom theme");
  });

  it("starts on the page's scheme", () => {
    setup({ customs: [sunrise], themeId: sunrise.id, dark: true });
    expect(tab("Dark").getAttribute("aria-selected")).toBe("true");
  });

  it("selects another theme when the id changes while open", () => {
    const { rerender } = setup({
      customs: [sunrise, inkwell],
      themeId: sunrise.id,
    });
    rerender(inkwell.id);
    expect((nameField() as HTMLInputElement).value).toBe("Inkwell");
  });

  it("flags a theme whose bases are gone, and still opens it", () => {
    const orphan: CustomTheme = {
      id: "custom-orphan",
      label: "Orphan",
      dark: { base: { theme: "not-here" } },
    };
    setup({ customs: [sunrise, orphan], themeId: sunrise.id });
    const options = themeOptions();
    expect(options.map((o) => o.textContent)).toEqual([
      "Sunrise",
      "Orphan(base missing)",
    ]);
    fireEvent.click(options[1] as HTMLElement);
    expect((nameField() as HTMLInputElement).value).toBe("Orphan");
    showTab("Dark");
    expect(screen.getByText(/is no longer available/).textContent).toContain(
      "not-here",
    );
  });
});

describe("ThemeEditor: unsaved changes", () => {
  it("marks the edited theme in the list", () => {
    setup({ customs: [sunrise, inkwell], themeId: sunrise.id });
    rename("Sunset");
    const [first, second] = themeOptions();
    expect(first?.querySelector("[data-unsaved]")).not.toBeNull();
    expect(first?.textContent).toContain("Sunset");
    expect(second?.querySelector("[data-unsaved]")).toBeNull();
  });

  it("closes at once when nothing changed", () => {
    const { onOpenChange, themes } = setup({
      customs: [sunrise],
      themeId: sunrise.id,
    });
    expect(themes.getPreview()).not.toBeNull();
    fireEvent.click(button("Cancel"));
    expect(unsavedPrompt()).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(themes.getPreview()).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks before closing with unsaved edits", () => {
    const { onOpenChange, themes } = setup({
      customs: [sunrise],
      themeId: sunrise.id,
    });
    rename("Sunset");
    fireEvent.click(button("Close"));
    expect(unsavedPrompt()).not.toBeNull();
    fireEvent.click(button("Keep editing"));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect((nameField() as HTMLInputElement).value).toBe("Sunset");

    fireEvent.keyDown(nameField(), { key: "Escape" });
    expect(unsavedPrompt()).not.toBeNull();
    fireEvent.click(button("Discard and leave"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(themes.getCustomThemes()).toEqual([sunrise]);
    expect(themes.getPreview()).toBeNull();
  });

  it("asks before switching themes with unsaved edits", () => {
    setup({ customs: [sunrise, inkwell], themeId: sunrise.id });
    rename("Sunset");
    fireEvent.click(themeOptions()[1] as HTMLElement);
    expect(unsavedPrompt()).not.toBeNull();
    fireEvent.click(button("Keep editing"));
    expect((nameField() as HTMLInputElement).value).toBe("Sunset");

    fireEvent.click(themeOptions()[1] as HTMLElement);
    fireEvent.click(button("Discard and leave"));
    expect((nameField() as HTMLInputElement).value).toBe("Inkwell");
  });

  it("does not reopen the prompt while the panel animates out", async () => {
    // With an exit animation the sheet keeps its content mounted after close.
    const style = document.createElement("style");
    style.textContent =
      "[data-state=closed] { animation-name: slide; animation-duration: 1s; }";
    document.head.append(style);
    try {
      stubDarkQuery(false);
      const themes = store();
      themes.setCustomThemes([sunrise, inkwell]);
      function App() {
        const [editing, setEditing] = useState<{ id?: string } | null>({
          id: inkwell.id,
        });
        return (
          <ThemeProvider store={themes}>
            <button
              type="button"
              onClick={() => setEditing({ id: sunrise.id })}
            >
              reopen
            </button>
            <ThemeEditor
              open={editing !== null}
              themeId={editing?.id}
              onOpenChange={(open) => {
                if (!open) setEditing(null);
              }}
            />
          </ThemeProvider>
        );
      }
      render(<App />);
      rename("Inkwell 2");
      fireEvent.click(button("Cancel"));
      await act(async () => {
        fireEvent.click(button("Discard and leave"));
      });
      // The old prompt may still be animating out; a new one would be open.
      expect(
        screen
          .queryAllByRole("alertdialog", {
            name: "Leave with unsaved changes?",
            hidden: true,
          })
          .concat(
            screen.queryAllByRole("dialog", {
              name: "Leave with unsaved changes?",
              hidden: true,
            }),
          )
          .map((d) => d.getAttribute("data-state")),
      ).not.toContain("open");
      expect(themes.getPreview()).toBeNull();

      // Reopened before the animation ends: a fresh session that previews.
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "reopen", hidden: true }),
        );
      });
      expect((nameField() as HTMLInputElement).value).toBe("Sunrise");
      expect(themes.getPreview()).not.toBeNull();
    } finally {
      style.remove();
    }
  });

  it("reports the draft to the unsaved-changes guard while dirty", () => {
    setup({ customs: [sunrise], themeId: sunrise.id });
    expect(hasUnsavedWork()).toBe(false);
    rename("Sunset");
    expect(hasUnsavedWork()).toBe(true);
    rename("Sunrise");
    expect(hasUnsavedWork()).toBe(false);
  });
});

describe("ThemeEditor: saving and deleting", () => {
  it("saves an edit in place and makes it the pick", () => {
    const { themes, onOpenChange } = setup({
      customs: [sunrise, inkwell],
      themeId: sunrise.id,
      pref: { ui: { theme: "solarized", mode: "system" } },
    });
    rename("  Sunset ");
    fireEvent.click(button("Save"));
    expect(themes.getCustomThemes()).toEqual([
      { ...sunrise, label: "Sunset" },
      inkwell,
    ]);
    // The mode is kept: a theme with both sides still follows the system.
    expect(themes.getPref().ui).toEqual({
      theme: "custom-sunrise",
      mode: "system",
    });
    expect(themes.getPreview()).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the editor open with the message when the store throws", () => {
    const { themes, onOpenChange } = setup({
      customs: [sunrise],
      themeId: sunrise.id,
    });
    vi.spyOn(themes, "setCustomThemes").mockImplementation(() => {
      throw new Error("storage is full");
    });
    rename("Sunset");
    fireEvent.click(button("Save"));
    expect(screen.getByRole("alert").textContent).toContain("storage is full");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect((nameField() as HTMLInputElement).value).toBe("Sunset");
  });

  it("deletes after confirming", () => {
    const { themes, onOpenChange } = setup({
      customs: [sunrise, inkwell],
      themeId: sunrise.id,
    });
    fireEvent.click(button("Delete"));
    const confirm = screen.getByRole("dialog", { name: "Delete Sunrise?" });
    expect(themes.getCustomThemes()).toHaveLength(2);
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    expect(themes.getCustomThemes()).toEqual([inkwell]);
    // The editor stays open on the next theme.
    expect(onOpenChange).not.toHaveBeenCalled();
    expect((nameField() as HTMLInputElement).value).toBe("Inkwell");
    expect(screen.queryByText(/deleted elsewhere/)).toBeNull();
  });

  it("opens a new theme after deleting the last one", () => {
    const { themes, onOpenChange } = setup({
      customs: [sunrise],
      themeId: sunrise.id,
    });
    fireEvent.click(button("Delete"));
    const confirm = screen.getByRole("dialog", { name: "Delete Sunrise?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    expect(themes.getCustomThemes()).toEqual([]);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect((nameField() as HTMLInputElement).value).toBe("Custom theme");
    expect((button("Delete") as HTMLButtonElement).disabled).toBe(true);
    expect(unsavedPrompt()).toBeNull();
  });

  it("cannot delete a theme that was never saved", () => {
    setup({ customs: [sunrise] });
    expect((button("Delete") as HTMLButtonElement).disabled).toBe(true);
  });

  it("duplicates as an unsaved copy with a free name", () => {
    const { themes } = setup({
      customs: [sunrise, { ...inkwell, label: "Sunrise copy" }],
      themeId: sunrise.id,
    });
    fireEvent.click(button("Duplicate"));
    expect((nameField() as HTMLInputElement).value).toBe("Sunrise copy (2)");
    fireEvent.click(button("Save"));
    const copy = themes.getCustomThemes()[2];
    expect(copy?.id).not.toBe(sunrise.id);
    expect(copy).toMatchObject({
      label: "Sunrise copy (2)",
      light: sunrise.light,
      dark: sunrise.dark,
    });
  });

  it("says when the open theme was deleted elsewhere, and saves it again", () => {
    const { themes } = setup({
      customs: [sunrise, inkwell],
      themeId: sunrise.id,
    });
    act(() => themes.setCustomThemes([inkwell]));
    expect(screen.getByText(/deleted elsewhere/)).toBeTruthy();
    fireEvent.click(button("Save"));
    expect(themes.getCustomThemes()).toEqual([inkwell, sunrise]);
  });
});

describe("ThemeEditor: validation", () => {
  it("needs a name", () => {
    setup({ customs: [sunrise], themeId: sunrise.id });
    rename("   ");
    expect(screen.getByText("A theme needs a name.")).toBeTruthy();
    expect((button("Save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("refuses a base theme's name, case-insensitively, and says whose it is", () => {
    setup({ customs: [sunrise], themeId: sunrise.id });
    rename("solarized");
    expect(
      screen.getByText('The theme "Solarized" already has this name.'),
    ).toBeTruthy();
    expect(nameField().getAttribute("aria-invalid")).toBe("true");
    expect((button("Save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("refuses another custom theme's name but not its own", () => {
    setup({ customs: [sunrise, inkwell], themeId: sunrise.id });
    rename("INKWELL");
    expect(
      screen.getByText('The theme "Inkwell" already has this name.'),
    ).toBeTruthy();
    rename("sunrise");
    expect((button("Save") as HTMLButtonElement).disabled).toBe(false);
  });

  it("needs a light or a dark side", () => {
    setup({ customs: [inkwell], themeId: inkwell.id });
    showTab("Dark");
    fireEvent.click(radio("Dark side", "None"));
    expect(screen.getByRole("alert").textContent).toBe(
      "A theme needs a light or a dark side.",
    );
    expect((button("Save") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("ThemeEditor: sides", () => {
  it("rebases a side keeping its overrides, and resets them", () => {
    const { themes } = setup({ customs: [sunrise], themeId: sunrise.id });
    expect(tab("Light").textContent).toContain("Solarized + 1");
    choose("Base theme", "GitHub");
    expect(tab("Light").textContent).toContain("GitHub + 1");
    fireEvent.click(button("Reset all (1)"));
    expect(tab("Light").textContent).toMatch(/GitHub$/);
    fireEvent.click(button("Save"));
    expect(themes.getCustomThemes()[0]?.light).toEqual({
      base: { theme: "github" },
    });
  });

  it("turns a side fully custom with the colours it showed", () => {
    const { themes } = setup({ customs: [sunrise], themeId: sunrise.id });
    const before = previewed(themes)?.theme.light;
    fireEvent.click(radio("Light side", "Fully custom"));
    expect(tab("Light").textContent).toContain("Fully custom");
    fireEvent.click(button("Save"));
    const light = themes.getCustomThemes()[0]?.light;
    expect(light).toEqual({
      tokens: before?.tokens,
      terminal: { tokens: before?.terminal },
    });
  });

  it("offers Follow the base only on a based side", () => {
    setup({ customs: [detached], themeId: detached.id });
    showTab("Terminal");
    expect(
      (radio("Terminal colours", "Follow the base") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      radio("Terminal colours", "Fully custom").getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("edits both terminals from one control until split", () => {
    const shared: CustomTheme = {
      ...sunrise,
      dark: { base: { theme: "solarized" } },
      light: { base: { theme: "solarized" } },
    };
    const { themes } = setup({ customs: [shared], themeId: shared.id });
    showTab("Terminal");
    expect(
      screen.getByRole("switch", { name: "Same terminal for both sides" }),
    ).toBeTruthy();
    fireEvent.click(radio("Terminal colours", "Based on a palette"));
    choose("Palette", "Nord");
    fireEvent.click(
      screen.getByRole("switch", { name: "Same terminal for both sides" }),
    );
    fireEvent.click(radio("Terminal of", "Dark side"));
    fireEvent.click(radio("Terminal colours", "Follow the base"));
    fireEvent.click(button("Save"));
    const saved = themes.getCustomThemes()[0] as CustomTheme;
    expect(saved?.light?.terminal).toEqual({ base: { theme: "nord" } });
    expect(saved?.dark?.terminal).toBeUndefined();
  });

  it("starts split when the sides follow different bases", () => {
    const apart: CustomTheme = {
      ...sunrise,
      light: { base: { theme: "solarized" } },
      dark: { base: { theme: "dracula" } },
    };
    setup({ customs: [apart], themeId: apart.id });
    showTab("Terminal");
    expect(
      screen
        .getByRole("switch", { name: "Same terminal for both sides" })
        .getAttribute("aria-checked"),
    ).toBe("false");
    expect(radio("Terminal of", "Light side")).toBeTruthy();
  });

  it("moves through a mode control with the arrow keys", () => {
    setup({ customs: [sunrise], themeId: sunrise.id });
    const radios = within(
      screen.getByRole("radiogroup", { name: "Light side" }),
    ).getAllByRole("radio");
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    const based = radio("Light side", "Based on a theme");
    based.focus();
    fireEvent.keyDown(based, { key: "ArrowRight" });
    const custom = radio("Light side", "Fully custom");
    expect(custom.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(custom);
    expect(custom.tabIndex).toBe(0);
    fireEvent.keyDown(custom, { key: "ArrowLeft" });
    expect(
      radio("Light side", "Based on a theme").getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("offers to keep a side whose base disappeared as fully custom", () => {
    const { themes } = setup({ customs: [sunrise], themeId: sunrise.id });
    const before = previewed(themes)?.theme.light;
    act(() =>
      themes.setThemes(builtinThemes.filter((t) => t.id !== "solarized")),
    );
    expect(screen.getByText(/is no longer available/).textContent).toBe(
      "Base solarized is no longer available.",
    );
    fireEvent.click(button("Keep as fully custom"));
    expect(screen.queryByText(/is no longer available/)).toBeNull();
    fireEvent.click(button("Save"));
    expect(themes.getCustomThemes()[0]?.light).toEqual({
      tokens: before?.tokens,
      terminal: { tokens: before?.terminal },
    });
  });
});

describe("ThemeEditor: token list", () => {
  it("counts overrides per group and opens the groups holding one", () => {
    setup({ customs: [sunrise], themeId: sunrise.id });
    const actions = button(/^Actions/);
    expect(actions.textContent).toContain("1 overridden");
    expect(actions.getAttribute("aria-expanded")).toBe("true");
    expect(button(/^Charts/).getAttribute("aria-expanded")).toBe("false");
  });

  it("filters and shows only overridden colours", () => {
    setup({ customs: [sunrise], themeId: sunrise.id });
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a colour" }), {
      target: { value: "chart-2" },
    });
    expect(button(/\(chart-2\)$/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /\(background\)$/ }),
    ).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a colour" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "Only overridden" }));
    expect(button(/\(primary\)$/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /\(secondary\)$/ })).toBeNull();
  });

  it("clears the filter on Esc without closing", () => {
    const { onOpenChange } = setup({ customs: [sunrise], themeId: sunrise.id });
    const filter = screen.getByRole("searchbox", { name: "Find a colour" });
    fireEvent.change(filter, { target: { value: "chart" } });
    fireEvent.keyDown(filter, { key: "Escape" });
    expect((filter as HTMLInputElement).value).toBe("");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Custom themes" })).toBeTruthy();

    // Empty, Esc closes as anywhere else.
    fireEvent.keyDown(filter, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps a group's open state per tab", () => {
    setup({ customs: [sunrise], themeId: sunrise.id });
    fireEvent.click(button(/^Charts/));
    showTab("Dark");
    expect(button(/^Charts/).getAttribute("aria-expanded")).toBe("false");
    showTab("Light");
    expect(button(/^Charts/).getAttribute("aria-expanded")).toBe("true");
  });
});

describe("ThemeEditor: preview", () => {
  it("previews the draft on the active tab's side", () => {
    const { themes } = setup({ customs: [sunrise], themeId: sunrise.id });
    expect(previewed(themes)).toMatchObject({
      theme: { id: sunrise.id },
      mode: "light",
    });
    expect(themes.getResolved()?.theme.id).toBe(sunrise.id);
    showTab("Dark");
    expect(previewed(themes)?.mode).toBe("dark");
    showTab("Terminal");
    expect(previewed(themes)?.mode).toBe("dark");
  });

  it("repaints on a drag, once a frame, and on a commit", async () => {
    const { themes } = setup({ customs: [sunrise], themeId: sunrise.id });
    const field = pick("background", PICKED);
    await waitFor(() =>
      expect(previewed(themes)?.theme.light?.tokens.background).toBe(PICKED),
    );
    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.keyDown(field, { key: "Escape" });
    expect(previewed(themes)?.theme.light?.tokens.background).toBe(PICKED);
    expect(tab("Light").textContent).toContain("Solarized + 2");
  });

  it("drops an uncommitted drag when the picker closes", async () => {
    const { themes } = setup({ customs: [sunrise], themeId: sunrise.id });
    const original = previewed(themes)?.theme.light?.tokens.background;
    const field = pick("background", PICKED);
    await waitFor(() =>
      expect(previewed(themes)?.theme.light?.tokens.background).toBe(PICKED),
    );
    fireEvent.keyDown(field, { key: "Escape" });
    expect(previewed(themes)?.theme.light?.tokens.background).toBe(original);
  });

  it("shows the edited terminal over a separate terminal pick", () => {
    const { themes } = setup({
      customs: [sunrise],
      themeId: sunrise.id,
      options: { terminalThemes: [...builtinThemes, ink, paper] },
      pref: {
        ui: { theme: "solarized", mode: "light" },
        terminal: { theme: "ink", mode: "dark" },
      },
    });
    expect(themes.getPreview()?.terminal).toBeUndefined();
    showTab("Terminal");
    expect(themes.getPreview()?.terminal).toBe("follow");
    expect(themes.getTerminal().following).toBe(true);
  });

  it("previews nothing while the draft has no side", () => {
    const { themes } = setup({ customs: [inkwell], themeId: inkwell.id });
    showTab("Dark");
    fireEvent.click(radio("Dark side", "None"));
    expect(themes.getPreview()).toBeNull();
  });
});
