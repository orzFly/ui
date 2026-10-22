import {
  builtinThemes,
  type ColorScheme,
  type CustomTheme,
  type TerminalTokenName,
  type TokenName,
} from "@orz/themes";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  type TerminalTarget,
  useThemeDraft,
} from "../src/components/theme-editor/draft.ts";
import { TokenList } from "../src/components/theme-editor/token-list.tsx";

const PRIMARY = "oklch(0.6 0.18 40)";

const based: CustomTheme = {
  id: "custom-sample",
  label: "Sample",
  light: { base: { theme: "solarized" }, tokens: { primary: PRIMARY } },
  dark: { base: { theme: "nord" } },
};

interface HarnessProps {
  initial: CustomTheme;
  kind?: "ui" | "terminal";
  scheme?: ColorScheme;
  target?: TerminalTarget;
  onPreview?: (name: string, value: string | null) => void;
  openGroups?: Record<string, boolean>;
  onOpenGroupsChange?: (open: Record<string, boolean>) => void;
}

let latest: CustomTheme;

/** The editor's wiring in miniature: the draft, its composition, the list. */
function Harness({
  initial,
  kind = "ui",
  scheme = "light",
  target = "light",
  onPreview,
  openGroups,
  onOpenGroupsChange,
}: HarnessProps) {
  const { draft, composed, dispatch } = useThemeDraft(
    { draft: initial, saved: initial },
    builtinThemes,
  );
  latest = draft;
  if (composed === null) return null;
  const palette =
    kind === "ui"
      ? composed[scheme]
      : composed[target === "both" ? "light" : target];
  if (palette === undefined) return null;
  return kind === "ui" ? (
    <TokenList
      kind="ui"
      draft={draft}
      dispatch={dispatch}
      scheme={scheme}
      values={palette.tokens}
      onPreview={onPreview as (name: TokenName, v: string | null) => void}
      openGroups={openGroups}
      onOpenGroupsChange={onOpenGroupsChange}
    />
  ) : (
    <TokenList
      kind="terminal"
      draft={draft}
      dispatch={dispatch}
      target={target}
      values={palette.terminal}
      onPreview={
        onPreview as (name: TerminalTokenName, v: string | null) => void
      }
    />
  );
}

const header = (label: string) =>
  new RegExp(`^${label}(\\s*\\d+ overridden)?$`);
const group = (label: string) =>
  screen.getByRole("button", { name: header(label) });
const queryGroup = (label: string) =>
  screen.queryByRole("button", { name: header(label) });
const swatch = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`\\(${name}\\)$`) });
const querySwatch = (name: string) =>
  screen.queryByRole("button", { name: new RegExp(`\\(${name}\\)$`) });
const filter = (text: string) =>
  fireEvent.change(screen.getByRole("searchbox", { name: "Find a colour" }), {
    target: { value: text },
  });

function openPicker(name: string) {
  const trigger = swatch(name);
  fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
  fireEvent.click(trigger);
  return screen.getByRole("textbox", { name: "Colour value" });
}

describe("TokenList groups", () => {
  it("opens Surfaces and groups holding an override, collapses the rest", () => {
    render(<Harness initial={based} />);
    expect(group("Surfaces").getAttribute("aria-expanded")).toBe("true");
    expect(group("Actions").getAttribute("aria-expanded")).toBe("true");
    expect(group("Charts").getAttribute("aria-expanded")).toBe("false");
    expect(querySwatch("chart-1")).toBeNull();
    expect(swatch("background")).toBeTruthy();
  });

  it("counts overrides in each group's header", () => {
    render(
      <Harness
        initial={{
          ...based,
          light: {
            base: { theme: "solarized" },
            tokens: { primary: PRIMARY, accent: PRIMARY, border: PRIMARY },
          },
        }}
      />,
    );
    expect(group("Actions").textContent).toContain("2 overridden");
    expect(group("Lines & focus").textContent).toContain("1 overridden");
    expect(group("Surfaces").textContent).not.toContain("overridden");
  });

  it("toggles a group and keeps it through the parent", () => {
    const onOpenGroupsChange = vi.fn();
    const { unmount } = render(
      <Harness initial={based} onOpenGroupsChange={onOpenGroupsChange} />,
    );
    fireEvent.click(group("Charts"));
    expect(onOpenGroupsChange).toHaveBeenLastCalledWith({ charts: true });
    unmount();
    render(<Harness initial={based} openGroups={{ charts: true }} />);
    expect(group("Charts").getAttribute("aria-expanded")).toBe("true");
    expect(swatch("chart-3")).toBeTruthy();
  });

  it("keeps its own toggles without a parent", () => {
    render(<Harness initial={based} />);
    fireEvent.click(group("Surfaces"));
    expect(group("Surfaces").getAttribute("aria-expanded")).toBe("false");
    expect(querySwatch("background")).toBeNull();
  });
});

describe("TokenList filter", () => {
  it("matches a label, marks it, and hides groups without a match", () => {
    render(<Harness initial={based} />);
    filter("card text");
    expect(swatch("card-foreground")).toBeTruthy();
    // The pair row keeps its surface beside the matched text.
    expect(swatch("card")).toBeTruthy();
    expect(querySwatch("background")).toBeNull();
    expect(queryGroup("Actions")).toBeNull();
    expect(screen.getByText("Card text", { selector: "mark" })).toBeTruthy();
  });

  it("matches a token name and opens its collapsed group", () => {
    render(<Harness initial={based} />);
    expect(group("Sidebar").getAttribute("aria-expanded")).toBe("false");
    filter("sidebar-ring");
    expect(group("Sidebar").getAttribute("aria-expanded")).toBe("true");
    expect(swatch("sidebar-ring")).toBeTruthy();
    expect(querySwatch("sidebar-border")).toBeNull();
    expect(queryGroup("Surfaces")).toBeNull();
  });

  it("restores the user's open groups once cleared", () => {
    render(<Harness initial={based} />);
    filter("chart");
    expect(swatch("chart-1")).toBeTruthy();
    filter("");
    expect(group("Charts").getAttribute("aria-expanded")).toBe("false");
  });

  it("says when nothing matches", () => {
    render(<Harness initial={based} />);
    filter("zzz");
    expect(screen.getByText("No colours match.")).toBeTruthy();
  });

  it("shows only overridden rows", () => {
    render(<Harness initial={based} />);
    fireEvent.click(screen.getByRole("switch", { name: "Only overridden" }));
    expect(swatch("primary")).toBeTruthy();
    expect(swatch("primary-foreground")).toBeTruthy();
    expect(querySwatch("secondary")).toBeNull();
    expect(queryGroup("Surfaces")).toBeNull();
  });
});

describe("TokenList rows", () => {
  it("says inherited or overridden on a based side", () => {
    render(<Harness initial={based} />);
    const primary = swatch("primary").parentElement as HTMLElement;
    expect(primary.textContent).toContain("overridden");
    const background = swatch("background").parentElement as HTMLElement;
    expect(background.textContent).toContain("inherited");
  });

  it("shows no state and no Only overridden on a fully custom side", () => {
    const resolved = builtinThemes.find((t) => t.id === "solarized");
    const light = resolved?.light;
    if (!light || !("tokens" in light)) throw new Error("no solarized light");
    render(
      <Harness
        initial={{
          id: "custom-detached",
          label: "Detached",
          light: { tokens: light.tokens, terminal: { tokens: light.terminal } },
        }}
      />,
    );
    expect(screen.queryByText("inherited")).toBeNull();
    expect(
      screen.queryByRole("switch", { name: "Only overridden" }),
    ).toBeNull();
  });

  it("commits a picked value as an override", () => {
    render(<Harness initial={based} />);
    const field = openPicker("background");
    fireEvent.change(field, { target: { value: "oklch(0.9 0.02 90)" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(latest.light).toEqual({
      base: { theme: "solarized" },
      tokens: { primary: PRIMARY, background: "oklch(0.9 0.02 90)" },
    });
    expect(group("Surfaces").textContent).toContain("1 overridden");
  });

  it("previews a change and clears the preview when the popover closes", () => {
    const onPreview = vi.fn();
    render(<Harness initial={based} onPreview={onPreview} />);
    const field = openPicker("background");
    fireEvent.change(field, { target: { value: "oklch(0.9 0.02 90)" } });
    expect(onPreview).toHaveBeenLastCalledWith(
      "background",
      "oklch(0.9 0.02 90)",
    );
    expect(latest.light).toEqual(based.light);
    fireEvent.keyDown(document.activeElement ?? field, { key: "Escape" });
    expect(onPreview).toHaveBeenLastCalledWith("background", null);
  });

  it("removes an override with ↺", () => {
    render(<Harness initial={based} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset primary" }));
    expect(latest.light).toEqual({ base: { theme: "solarized" } });
    expect(screen.queryByRole("button", { name: "Reset primary" })).toBeNull();
  });

  it("shows a pair's ratio, amber below 4.5:1", () => {
    render(
      <Harness
        initial={{
          ...based,
          light: {
            base: { theme: "solarized" },
            tokens: {
              background: "#ffffff",
              foreground: "#000000",
              card: "#ffffff",
              "card-foreground": "#999999",
            },
          },
        }}
      />,
    );
    const ratios = document.querySelectorAll("[data-contrast]");
    expect(ratios[0]?.textContent).toBe("21.00:1");
    expect(ratios[0]?.hasAttribute("data-low")).toBe(false);
    expect(ratios[1]?.textContent).toBe("2.84:1");
    expect(ratios[1]?.hasAttribute("data-low")).toBe(true);
    expect(ratios[1]?.className).toContain("amber");
  });
});

describe("TokenList terminal", () => {
  const shared: CustomTheme = {
    ...based,
    light: {
      base: { theme: "solarized" },
      terminal: {
        base: { theme: "nord", scheme: "dark" },
        tokens: { "ansi-red": "#ff0000" },
      },
    },
    dark: {
      base: { theme: "nord" },
      terminal: {
        base: { theme: "nord", scheme: "dark" },
        tokens: { "ansi-red": "#ff0000" },
      },
    },
  };

  it("lays out the pair, a 2 × 8 ANSI grid, then cursor and selection", () => {
    render(<Harness initial={shared} kind="terminal" target="both" />);
    expect(group("Background & text").getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(group("ANSI colours").textContent).toContain("1 overridden");
    const ansi = group("ANSI colours").nextElementSibling as HTMLElement;
    const rows = within(ansi).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getAllByRole("button")).toHaveLength(
      9, // eight swatches and ansi-red's ↺
    );
    expect(swatch("ansi-bright-white")).toBeTruthy();
    fireEvent.click(group("Cursor & selection"));
    expect(swatch("terminal-selection")).toBeTruthy();
  });

  it("writes both sides from the shared control", () => {
    render(<Harness initial={shared} kind="terminal" target="both" />);
    const field = openPicker("ansi-green");
    fireEvent.change(field, { target: { value: "#00ff00" } });
    fireEvent.keyDown(field, { key: "Enter" });
    for (const scheme of ["light", "dark"] as const) {
      expect(latest[scheme]?.terminal).toEqual({
        base: { theme: "nord", scheme: "dark" },
        tokens: { "ansi-red": "#ff0000", "ansi-green": "#00ff00" },
      });
    }
    fireEvent.click(screen.getByRole("button", { name: "Reset ansi-red" }));
    expect(latest.dark?.terminal).toEqual({
      base: { theme: "nord", scheme: "dark" },
      tokens: { "ansi-green": "#00ff00" },
    });
  });

  it("says inherited on a terminal that follows its base", () => {
    render(<Harness initial={based} kind="terminal" target="dark" />);
    expect(screen.getAllByText("inherited").length).toBeGreaterThan(0);
  });
});
