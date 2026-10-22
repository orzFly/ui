import { builtinThemes, type CustomTheme } from "@orz/themes";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ThemeEditor } from "../src/components/theme-editor.tsx";
import { serializeThemeFile } from "../src/lib/theme-file.ts";
import { ThemeProvider } from "../src/theme/index.ts";
import {
  inkwell,
  resetThemeEnvironment,
  store,
  stubDarkQuery,
  sunrise,
} from "./theme-helpers.ts";

resetThemeEnvironment();

/** Dark only, on built-ins alone, so it imports unchanged. */
const harbour: CustomTheme = {
  id: "custom-harbour",
  label: "Harbour",
  dark: {
    base: { theme: "nord" },
    tokens: { primary: "oklch(0.7 0.12 220)" },
  },
};

function setup({
  customs = [],
  themeId,
}: {
  customs?: CustomTheme[];
  themeId?: string;
} = {}) {
  stubDarkQuery(false);
  const themes = store();
  themes.setCustomThemes(customs);
  const onOpenChange = vi.fn();
  function App() {
    const [open, setOpen] = useState(true);
    return (
      <ThemeProvider store={themes}>
        <ThemeEditor
          open={open}
          themeId={themeId}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
        />
      </ThemeProvider>
    );
  }
  render(<App />);
  return { themes, onOpenChange };
}

const button = (name: string | RegExp) => screen.getByRole("button", { name });
const fileField = () =>
  screen.getByRole("textbox", { name: "Theme file" }) as HTMLTextAreaElement;
const nameField = () =>
  screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement;
const fileInput = () =>
  screen.getByTestId("theme-file-input") as HTMLInputElement;
const paste = (text: string) =>
  fireEvent.change(fileField(), { target: { value: text } });
const rows = () =>
  within(screen.getByRole("list", { name: "Themes in the file" })).getAllByRole(
    "listitem",
  );
const checkbox = (row: HTMLElement) =>
  within(row).getByRole("checkbox") as HTMLInputElement;

/**
 * Four entries, one per status: kept as is, renamed for a base theme's label,
 * a light side whose base is missing (detached from its saved colours), and
 * one with no side at all.
 */
function mixedFile(): string {
  const file = JSON.parse(
    serializeThemeFile(
      [
        harbour,
        { ...harbour, label: "solarized" },
        { ...sunrise, label: "Lantern" },
      ],
      builtinThemes,
    ),
  );
  file.themes[2].light.base.theme = "gone-theme";
  file.themes.push({ label: "Empty" });
  return JSON.stringify(file);
}

function chooseFile(file: File) {
  fireEvent.change(fileInput(), { target: { files: [file] } });
}

describe("ThemeEditor: import", () => {
  it("lists each theme in the file with its status before importing", async () => {
    const { themes } = setup({ customs: [sunrise] });
    fireEvent.click(button("Import…"));
    paste(mixedFile());
    await waitFor(() => expect(rows()).toHaveLength(4));
    const [ok, renamed, adjusted, rejected] = rows() as HTMLElement[];
    expect(ok?.dataset.status).toBe("ok");
    expect(renamed?.dataset.status).toBe("renamed");
    expect(renamed?.textContent).toContain("solarized (2)");
    expect(renamed?.textContent).toContain(
      'Renamed from "solarized": a theme with that name already exists.',
    );
    expect(adjusted?.dataset.status).toBe("adjusted");
    expect(adjusted?.textContent).toContain(
      "gone-theme isn't available here; the light side is imported as Fully custom from the colours saved in the file.",
    );
    expect(rejected?.dataset.status).toBe("rejected");
    expect(rejected?.textContent).toContain(
      "It has neither a light nor a dark side.",
    );

    for (const row of [ok, renamed, adjusted]) {
      expect(checkbox(row as HTMLElement).checked).toBe(true);
    }
    expect(checkbox(rejected as HTMLElement).checked).toBe(false);
    expect(checkbox(rejected as HTMLElement).disabled).toBe(true);
    expect(themes.getCustomThemes()).toEqual([sunrise]);
    expect(button("Import 3")).toBeTruthy();
  });

  it("imports the checked themes with new ids and opens the first", async () => {
    const { themes } = setup({ customs: [sunrise] });
    fireEvent.click(button("Import…"));
    paste(mixedFile());
    await waitFor(() => expect(rows()).toHaveLength(4));
    fireEvent.click(checkbox(rows()[1] as HTMLElement));
    fireEvent.click(button("Import 2"));

    const list = themes.getCustomThemes();
    expect(list.map((c) => c.label)).toEqual(["Sunrise", "Harbour", "Lantern"]);
    const [, kept, lantern] = list as CustomTheme[];
    expect(kept?.id).toMatch(/^custom-[0-9a-z]{8}$/);
    expect(lantern?.id).toMatch(/^custom-[0-9a-z]{8}$/);
    expect(kept?.id).not.toBe(lantern?.id);
    expect(kept?.dark).toEqual(harbour.dark);
    expect(lantern?.light && "base" in lantern.light).toBe(false);
    expect(JSON.stringify(list)).not.toContain("resolved");

    expect(nameField().value).toBe("Harbour");
    expect(screen.queryByRole("option", { name: /Harbour/ })).toBeNull();
    expect(button("Save")).toBeTruthy();
  });

  it("imports the same file twice without clashing", async () => {
    const { themes } = setup();
    const text = serializeThemeFile([inkwell], builtinThemes);
    for (let i = 0; i < 2; i++) {
      fireEvent.click(button("Import…"));
      paste(text);
      await waitFor(() => expect(rows()).toHaveLength(1));
      fireEvent.click(button("Import 1"));
    }
    const list = themes.getCustomThemes();
    expect(list.map((c) => c.label)).toEqual(["Inkwell", "Inkwell (2)"]);
    expect(new Set(list.map((c) => c.id)).size).toBe(2);
  });

  it("shows a whole-file error and lists nothing", async () => {
    setup();
    fireEvent.click(button("Import…"));
    paste("{ not json");
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "This isn't a theme file: it is not valid JSON.",
      ),
    );
    expect(screen.queryByRole("list", { name: "Themes in the file" })).toBe(
      null,
    );
  });

  it("reads a chosen file", async () => {
    setup();
    fireEvent.click(button("Import…"));
    const text = serializeThemeFile([inkwell], builtinThemes);
    chooseFile(new File([text], "inkwell.json", { type: "application/json" }));
    await waitFor(() => expect(fileField().value).toBe(text));
    await waitFor(() => expect(rows()).toHaveLength(1));
  });

  it("reads a file dropped on the panel", async () => {
    setup();
    fireEvent.click(button("Import…"));
    const text = serializeThemeFile([inkwell], builtinThemes);
    const file = new File([text], "inkwell.json");
    fireEvent.drop(fileField(), {
      dataTransfer: { files: [file], types: ["Files"] },
    });
    await waitFor(() => expect(rows()).toHaveLength(1));
  });

  it("refuses an oversize file without reading it", async () => {
    setup();
    fireEvent.click(button("Import…"));
    const file = new File(["{}"], "huge.json");
    Object.defineProperty(file, "size", { value: 1_000_001 });
    const read = vi.spyOn(file, "text");
    chooseFile(file);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "This file is too large to be a theme file.",
      ),
    );
    expect(read).not.toHaveBeenCalled();
    expect(fileField().value).toBe("");
  });

  it("asks before replacing a draft with unsaved edits", async () => {
    const { themes } = setup({ customs: [sunrise], themeId: sunrise.id });
    fireEvent.change(nameField(), { target: { value: "Sunset" } });
    fireEvent.click(button("Import…"));
    paste(serializeThemeFile([inkwell], builtinThemes));
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(button("Import 1"));
    expect(
      screen.getByRole("dialog", { name: "Leave with unsaved changes?" }),
    ).toBeTruthy();
    fireEvent.click(button("Keep editing"));
    expect(themes.getCustomThemes()).toEqual([sunrise]);

    fireEvent.click(button("Import 1"));
    fireEvent.click(button("Discard and leave"));
    expect(themes.getCustomThemes().map((c) => c.label)).toEqual([
      "Sunrise",
      "Inkwell",
    ]);
    expect(nameField().value).toBe("Inkwell");
  });

  it("goes back to the form", () => {
    setup({ customs: [sunrise], themeId: sunrise.id });
    fireEvent.click(button("Import…"));
    fireEvent.click(button("Back to the theme"));
    expect(nameField().value).toBe("Sunrise");
  });

  it("moves focus into the panel it shows", () => {
    setup({ customs: [sunrise], themeId: sunrise.id });
    fireEvent.click(button("Import…"));
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Theme file" }),
    );
    fireEvent.click(button("Back to the theme"));
    expect(document.activeElement).toBe(nameField());
    fireEvent.click(button("Export"));
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Theme file" }),
    );
  });
});

describe("ThemeEditor: export", () => {
  it("exports the open theme from the footer, edits included", () => {
    setup({ customs: [sunrise, inkwell], themeId: sunrise.id });
    fireEvent.change(nameField(), { target: { value: "Sunset" } });
    fireEvent.click(button("Export"));
    expect(screen.getByRole("heading", { name: "Export Sunset" })).toBeTruthy();
    expect(fileField().readOnly).toBe(true);
    expect(fileField().value).toBe(
      serializeThemeFile([{ ...sunrise, label: "Sunset" }], builtinThemes),
    );
    const file = JSON.parse(fileField().value);
    expect(file.themes).toHaveLength(1);
    expect(file.themes[0].id).toBeUndefined();
    expect(file.themes[0].light.resolved.tokens.primary).toBe(
      "oklch(0.6 0.18 40)",
    );
  });

  it("exports every custom theme from the header", () => {
    setup({ customs: [sunrise, inkwell], themeId: sunrise.id });
    fireEvent.click(button("Export all"));
    expect(fileField().value).toBe(
      serializeThemeFile([sunrise, inkwell], builtinThemes),
    );
  });

  it("downloads under a file name made from the label", () => {
    setup({
      customs: [{ ...sunrise, label: "Paper & Ink" }, inkwell],
      themeId: sunrise.id,
    });
    const blobs: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return "blob:theme-file";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });

    fireEvent.click(button("Export"));
    fireEvent.click(button("Download .json"));
    fireEvent.click(button("Back to the theme"));
    fireEvent.click(button("Export all"));
    fireEvent.click(button("Download .json"));

    expect(names).toEqual([
      "paper-and-ink.orz-themes.json",
      "custom-themes.orz-themes.json",
    ]);
    expect(blobs[0]?.type).toBe("application/json");
  });

  it("names a file whose label has nothing to slug custom-theme", () => {
    setup({ customs: [{ ...inkwell, label: "★ ★" }], themeId: inkwell.id });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:theme-file");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    fireEvent.click(button("Export"));
    fireEvent.click(button("Download .json"));
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      "custom-theme.orz-themes.json",
    );
  });

  it("copies the file, and selects it when the clipboard is blocked", async () => {
    setup({ customs: [inkwell], themeId: inkwell.id });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    fireEvent.click(button("Export"));
    fireEvent.click(button("Copy"));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(fileField().value),
    );
    expect(fileField().selectionEnd).toBe(fileField().selectionStart);

    writeText.mockRejectedValue(new Error("blocked"));
    fireEvent.click(button("Copy"));
    await waitFor(() => {
      expect(fileField().selectionStart).toBe(0);
      expect(fileField().selectionEnd).toBe(fileField().value.length);
    });
  });
});
