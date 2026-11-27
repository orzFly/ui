import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createRef, useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  FilterMenu,
  type FilterMenuHandle,
  type FilterMenuSelectEvent,
  matchText,
} from "../src/components/filter-menu.tsx";

interface Label {
  id: string;
  label: string;
  disabled?: boolean;
  action?: boolean;
}

const LABELS: Label[] = [
  { id: "bug", label: "bug" },
  { id: "docs", label: "docs" },
  { id: "ui", label: "ui" },
  { id: "wontfix", label: "wontfix", disabled: true },
  { id: "perf", label: "perf" },
];

const DISTRICTS: Record<string, Label[]> = {
  ui: [
    { id: "ui/buttons", label: "buttons" },
    { id: "ui/menus", label: "menus" },
  ],
};

type OnSelect = (row: Label, event: FilterMenuSelectEvent) => void;

function Harness({
  onSelect,
  extra = [],
  handle,
  links = false,
  submenus = false,
}: {
  onSelect?: OnSelect;
  /** Rows the caller adds ahead of the list, as data that arrives late does. */
  extra?: Label[];
  handle?: React.Ref<FilterMenuHandle>;
  links?: boolean;
  submenus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(["bug", "ui/menus"]);
  const [mixed, setMixed] = useState<string[]>(["docs"]);
  const rows = useMemo(() => {
    const hits = [...extra, ...LABELS].filter((row) =>
      matchText(row.label, query),
    );
    const known = LABELS.some((row) => row.label === query.trim());
    if (query.trim() !== "" && !known) {
      hits.push({ id: "create", label: `Create “${query}”`, action: true });
    }
    return hits;
  }, [query, extra]);
  return (
    <>
      <button type="button">before</button>
      <FilterMenu
        ref={handle}
        selection="multiple"
        selectedIds={selected}
        mixedIds={mixed}
        query={query}
        onQueryChange={setQuery}
        sections={[{ id: "all", rows }]}
        renderRow={(row, state) => (
          <span
            data-row-state={
              state.selected ? "selected" : state.mixed ? "mixed" : "none"
            }
          >
            {row.label}
          </span>
        )}
        rowLink={
          links ? (row) => (row.id === "perf" ? "#perf" : undefined) : undefined
        }
        getSubmenu={submenus ? (row) => DISTRICTS[row.id] : undefined}
        submenuLabel={(row) => `${row.label} areas`}
        onSelect={(row, event) => {
          onSelect?.(row, event);
          if (row.action) {
            setQuery("");
            return;
          }
          setMixed((ids) => ids.filter((id) => id !== row.id));
          setSelected((ids) =>
            event.selected
              ? [...ids, row.id]
              : ids.filter((id) => id !== row.id),
          );
        }}
        inputLabel="Filter labels"
        listLabel="Labels"
      >
        <button type="button">Labels</button>
      </FilterMenu>
    </>
  );
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: "Labels" }));
  return screen.getByRole("combobox", { name: "Filter labels" });
}

const option = (name: string) => screen.getByRole("option", { name });

function highlighted() {
  const id = screen.getByRole("combobox").getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.textContent : undefined;
}

function key(el: HTMLElement, k: string) {
  fireEvent.keyDown(el, { key: k });
}

/** Each row's aria-checked, `-` for none. */
function checks() {
  return Object.fromEntries(
    screen
      .getAllByRole("option")
      .map((el) => [el.textContent, el.getAttribute("aria-checked") ?? "-"]),
  );
}

describe("FilterMenu with multiple selection", () => {
  it("marks the list multiselectable, and each choice checked, unchecked or mixed", () => {
    render(<Harness />);
    const box = open();
    const list = screen.getByRole("listbox", { name: "Labels" });
    expect(list.getAttribute("aria-multiselectable")).toBe("true");
    expect(checks()).toEqual({
      bug: "true",
      docs: "mixed",
      ui: "false",
      wontfix: "false",
      perf: "false",
    });
    for (const el of screen.getAllByRole("option")) {
      expect(el.hasAttribute("aria-selected")).toBe(false);
    }
    const marks = screen
      .getAllByRole("option")
      .map((el) =>
        el
          .querySelector("[data-slot=checkbox-mark]")
          ?.getAttribute("data-state"),
      );
    expect(marks).toEqual([
      "checked",
      "indeterminate",
      "unchecked",
      "unchecked",
      "unchecked",
    ]);
    // The box is drawn, not operated: a screen reader hears the row.
    const mark = option("bug").querySelector("[data-slot=checkbox-mark]");
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
    expect(
      option("bug").querySelector("[data-slot=checkbox-mark] svg"),
    ).toBeTruthy();
    expect(
      [...document.querySelectorAll("[data-row-state]")].map((el) =>
        el.getAttribute("data-row-state"),
      ),
    ).toEqual(["selected", "mixed", "none", "none", "none"]);
    // No check at the row's end, which single selection draws.
    expect(option("bug").querySelector(".absolute svg")).toBeNull();

    fireEvent.change(box, { target: { value: "new" } });
    const create = option("Create “new”");
    expect(create.hasAttribute("aria-checked")).toBe(false);
    expect(create.hasAttribute("aria-selected")).toBe(false);
    expect(create.querySelector("[data-slot=checkbox-mark]")).toBeNull();
    expect(
      create.querySelector("[data-row-state]")?.getAttribute("data-row-state"),
    ).toBe("none");
  });

  it("picks on a click or Enter, staying open with the query, the highlight and the focus", () => {
    const onSelect = vi.fn<OnSelect>();
    render(<Harness onSelect={onSelect} />);
    const box = open();
    fireEvent.change(box, { target: { value: "u" } });
    expect(highlighted()).toBe("bug");
    key(box, "Enter");
    expect(onSelect.mock.calls.at(-1)?.[0].id).toBe("bug");
    expect(onSelect.mock.calls.at(-1)?.[1].selected).toBe(false);
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(box).toHaveProperty("value", "u");
    expect(document.activeElement).toBe(box);
    expect(highlighted()).toBe("bug");
    expect(option("bug").getAttribute("aria-checked")).toBe("false");

    fireEvent.change(box, { target: { value: "" } });
    for (const [name, selected] of [
      ["ui", true],
      ["docs", true],
      ["bug", true],
    ] as const) {
      fireEvent.pointerMove(option(name));
      fireEvent.click(option(name));
      expect(onSelect.mock.calls.at(-1)?.[0].id).toBe(name);
      expect(onSelect.mock.calls.at(-1)?.[1].selected).toBe(selected);
      expect(highlighted()).toBe(name);
    }
    expect(checks()).toMatchObject({ bug: "true", docs: "true", ui: "true" });
    // Checked, it asks to be unchecked.
    fireEvent.click(option("ui"));
    expect(onSelect.mock.calls.at(-1)?.[1].selected).toBe(false);
    // A prevented default changes nothing: the menu stays open anyway.
    onSelect.mockImplementationOnce((_row, event) => event.preventDefault());
    fireEvent.click(option("perf"));
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(document.activeElement).toBe(box);
    // A disabled row is no pick.
    const calls = onSelect.mock.calls.length;
    fireEvent.click(option("wontfix"));
    expect(onSelect.mock.calls).toHaveLength(calls);
  });

  it("highlights nothing on opening, with the box cleared, or once reset, so Enter picks nothing", () => {
    const onSelect = vi.fn<OnSelect>();
    const handle = createRef<FilterMenuHandle>();
    render(<Harness onSelect={onSelect} handle={handle} />);
    const box = open();
    expect(box.hasAttribute("aria-activedescendant")).toBe(false);
    key(box, "Enter");
    expect(onSelect).not.toHaveBeenCalled();

    // The first row that is not disabled, past `wontfix`.
    fireEvent.change(box, { target: { value: "f" } });
    expect(highlighted()).toBe("perf");
    fireEvent.change(box, { target: { value: "" } });
    expect(box.hasAttribute("aria-activedescendant")).toBe(false);
    key(box, "Enter");
    expect(onSelect).not.toHaveBeenCalled();

    key(box, "ArrowDown");
    expect(highlighted()).toBe("bug");
    act(() => handle.current?.resetHighlight());
    expect(box.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("highlights an action row that comes first, and picks it with Enter", () => {
    const onSelect = vi.fn<OnSelect>();
    render(<Harness onSelect={onSelect} />);
    const box = open();
    fireEvent.change(box, { target: { value: "triage" } });
    expect(highlighted()).toBe("Create “triage”");
    key(box, "Enter");
    expect(onSelect.mock.calls.at(-1)?.[0].id).toBe("create");
    expect(onSelect.mock.calls.at(-1)?.[1].selected).toBe(true);
    // The caller cleared the box: the highlight rests on nothing again.
    expect(box).toHaveProperty("value", "");
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(box.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("keeps the highlight on a picked row as the list changes under it", () => {
    const { rerender } = render(<Harness />);
    const box = open();
    fireEvent.change(box, { target: { value: "u" } });
    key(box, "ArrowDown");
    expect(highlighted()).toBe("ui");
    key(box, "Enter");
    // A row arriving ahead of it would take a first hit's highlight.
    rerender(<Harness extra={[{ id: "auth", label: "auth" }]} />);
    expect(screen.getAllByRole("option")[0]?.textContent).toBe("auth");
    expect(highlighted()).toBe("ui");
    // A new query places it anew.
    fireEvent.change(box, { target: { value: "au" } });
    expect(highlighted()).toBe("auth");
  });

  it("treats a link row as no choice: no box, no state, and picking it leaves the menu open", () => {
    const onSelect = vi.fn<OnSelect>();
    render(<Harness onSelect={onSelect} links />);
    open();
    const perf = option("perf");
    expect(perf.matches("a[href]")).toBe(true);
    expect(perf.hasAttribute("aria-checked")).toBe(false);
    expect(perf.hasAttribute("aria-selected")).toBe(false);
    expect(perf.querySelector("[data-slot=checkbox-mark]")).toBeNull();
    fireEvent.click(perf);
    expect(onSelect.mock.calls.at(-1)?.[1].selected).toBe(true);
    expect(screen.getByRole("listbox", { name: "Labels" })).toBeTruthy();
  });

  it("checks a submenu's rows by the same ids, and keeps both open on a pick there", () => {
    const onSelect = vi.fn<OnSelect>();
    render(<Harness onSelect={onSelect} submenus />);
    open();
    fireEvent.pointerMove(option("ui"));
    const submenu = screen.getByRole("listbox", { name: "ui areas" });
    expect(submenu.getAttribute("aria-multiselectable")).toBe("true");
    expect(
      screen
        .getAllByRole("option")
        .filter((el) => submenu.contains(el))
        .map((el) => [el.textContent, el.getAttribute("aria-checked")]),
    ).toEqual([
      ["buttons", "false"],
      ["menus", "true"],
    ]);
    fireEvent.pointerMove(option("buttons"));
    fireEvent.click(option("buttons"));
    expect(onSelect.mock.calls.at(-1)?.[0].id).toBe("ui/buttons");
    expect(onSelect.mock.calls.at(-1)?.[1].selected).toBe(true);
    expect(screen.getByRole("listbox", { name: "Labels" })).toBeTruthy();
    expect(screen.getByRole("listbox", { name: "ui areas" })).toBeTruthy();
    expect(option("buttons").getAttribute("aria-checked")).toBe("true");
    expect(highlighted()).toBe("buttons");

    // The parent's own half picks the parent alone.
    fireEvent.click(
      option("ui").querySelector("[data-slot=submenu-action]") as Element,
    );
    expect(onSelect.mock.calls.at(-1)?.[0].id).toBe("ui");
    expect(option("ui").getAttribute("aria-checked")).toBe("true");
    expect(option("buttons").getAttribute("aria-checked")).toBe("true");
  });

  it("opens without a fine pointer on the list, where Enter picks nothing and a tap picks a row", async () => {
    const onSelect = vi.fn<OnSelect>();
    render(
      <div data-pointer="coarse">
        <Harness onSelect={onSelect} />
      </div>,
    );
    open();
    const list = screen.getByRole("listbox", { name: "Labels" });
    expect(document.activeElement).toBe(list);
    key(list, "Enter");
    expect(onSelect).not.toHaveBeenCalled();
    const ui = option("ui");
    fireEvent.pointerDown(ui, { pointerType: "touch" });
    expect(fireEvent.mouseDown(ui)).toBe(false);
    fireEvent.click(ui);
    expect(onSelect.mock.calls.at(-1)?.[0].id).toBe("ui");
    expect(option("ui").getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(list);
    expect(highlighted()).toBe("ui");
    key(screen.getByRole("combobox"), "Escape");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Labels" }),
      ),
    );
  });
});
