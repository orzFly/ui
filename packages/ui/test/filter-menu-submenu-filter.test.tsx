import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  FilterMenu,
  type FilterMenuSection,
  MatchedText,
  matchText,
} from "../src/components/filter-menu.tsx";

interface Row {
  id: string;
  label: string;
  disabled?: boolean;
}

const ROWS: Row[] = [
  { id: "apple", label: "Apple" },
  { id: "pear", label: "Pear" },
  { id: "plum", label: "Plum" },
];
const VARIETIES: Record<string, Row[]> = {
  apple: [
    { id: "apple:gala", label: "Gala" },
    { id: "apple:fuji", label: "Fuji" },
    { id: "apple:braeburn", label: "Braeburn" },
    { id: "apple:crab", label: "Crab", disabled: true },
  ],
  plum: [{ id: "plum:damson", label: "Damson" }],
};

function Harness({
  onHighlight,
  onSelect = () => {},
  getSubmenu = (row: Row, q: string) =>
    VARIETIES[row.id]?.filter((v) => matchText(v.label, q)),
}: {
  onHighlight?: (row: Row | null) => void;
  onSelect?: (row: Row) => void;
  getSubmenu?: (row: Row, q: string) => readonly Row[] | undefined;
}) {
  const [query, setQuery] = useState("");
  const sections = useMemo<FilterMenuSection<Row>[]>(
    () => [
      { id: "fruit", rows: ROWS.filter((row) => matchText(row.label, query)) },
    ],
    [query],
  );
  return (
    <FilterMenu
      query={query}
      onQueryChange={setQuery}
      sections={sections}
      selectedId="pear"
      getSubmenu={getSubmenu}
      // Plum's submenu has no box, to show the two side by side.
      submenuFilter={(row) =>
        row.id === "apple" ? { placeholder: "Filter varieties…" } : undefined
      }
      submenuLabel={(row) => `${row.label} varieties`}
      onHighlight={onHighlight}
      onSelect={onSelect}
      renderRow={(row, state) => (
        <MatchedText text={row.label} query={state.query} />
      )}
      inputLabel="Filter fruit"
      listLabel="Fruit"
    >
      <button type="button">Pick</button>
    </FilterMenu>
  );
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: "Pick" }));
  return screen.getByRole("combobox", { name: "Filter fruit" });
}

const subBox = () =>
  screen.getByRole("combobox", {
    name: "Filter Apple varieties",
  }) as HTMLInputElement;

/** The highlighted option's text, read off whichever box has focus. */
function highlighted() {
  const id = document.activeElement?.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.textContent : undefined;
}

function key(el: HTMLElement, k: string) {
  fireEvent.keyDown(el, { key: k });
}

const subTexts = () =>
  [
    ...screen
      .getByRole("listbox", { name: "Apple varieties" })
      .querySelectorAll('[role="option"]'),
  ].map((o) => o.textContent);

const ids = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls.map(([row]) => (row as Row | null)?.id ?? null);

/** Apple highlighted by the user, so its submenu is open. */
function openApple() {
  const box = open();
  key(box, "ArrowUp");
  return box;
}

describe("FilterMenu submenu filter", () => {
  it("puts a box over only the submenus that ask for one", () => {
    render(<Harness />);
    const box = openApple();
    expect(subBox().placeholder).toBe("Filter varieties…");
    expect(subBox().getAttribute("aria-controls")).toBe(
      screen.getByRole("listbox", { name: "Apple varieties" }).id,
    );
    // Focus stays in the menu's box until the user goes into the submenu.
    expect(document.activeElement).toBe(box);
    key(box, "End");
    expect(
      screen.getByRole("listbox", { name: "Plum varieties" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("takes the keys on →, filters as it is typed in, and picks with Enter", () => {
    const onHighlight = vi.fn();
    const onSelect = vi.fn();
    render(<Harness onHighlight={onHighlight} onSelect={onSelect} />);
    const box = openApple();
    key(box, "ArrowRight");
    expect(document.activeElement).toBe(subBox());
    expect(highlighted()).toBe("Gala");

    fireEvent.change(subBox(), { target: { value: "bur" } });
    expect(subTexts()).toEqual(["Braeburn"]);
    expect(highlighted()).toBe("Braeburn");
    const mark = screen
      .getByRole("listbox", { name: "Apple varieties" })
      .querySelector("mark");
    expect(mark?.textContent).toBe("bur");
    // The menu's own list is untouched by the submenu's query.
    expect((box as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("option", { name: "Pear" })).toBeTruthy();

    key(subBox(), "Enter");
    expect(onSelect).toHaveBeenCalledWith(VARIETIES.apple?.[2]);
    expect(ids(onHighlight)).toEqual([
      "apple",
      "apple:gala",
      "apple:braeburn",
      null,
    ]);
  });

  it("walks the filtered rows, and says so when none match", () => {
    render(<Harness />);
    const box = openApple();
    key(box, "ArrowRight");
    fireEvent.change(subBox(), { target: { value: "a" } });
    expect(subTexts()).toEqual(["Gala", "Braeburn", "Crab"]);
    expect(highlighted()).toBe("Gala");
    key(subBox(), "ArrowDown");
    expect(highlighted()).toBe("Braeburn");
    // Crab is disabled.
    key(subBox(), "ArrowDown");
    expect(highlighted()).toBe("Braeburn");
    fireEvent.change(subBox(), { target: { value: "zzz" } });
    expect(subTexts()).toEqual([]);
    expect(highlighted()).toBeUndefined();
    expect(
      screen.getByRole("listbox", { name: "Apple varieties" }).textContent,
    ).toBe('No matches for "zzz"');
    // Enter with nothing highlighted picks nothing and keeps the menu.
    key(subBox(), "Enter");
    expect(screen.getByRole("listbox", { name: "Fruit" })).toBeTruthy();
  });

  it("enters a submenu filtered down to nothing", () => {
    render(<Harness />);
    const box = openApple();
    key(box, "ArrowRight");
    fireEvent.change(subBox(), { target: { value: "zzz" } });
    subBox().setSelectionRange(0, 0);
    key(subBox(), "ArrowLeft");
    expect(document.activeElement).toBe(box);
    key(box, "ArrowRight");
    expect(document.activeElement).toBe(subBox());
    expect(subBox().value).toBe("zzz");
  });

  it("hands the keys back on ← at the caret's start, and on Escape", () => {
    const onHighlight = vi.fn();
    render(<Harness onHighlight={onHighlight} />);
    const box = openApple();
    key(box, "ArrowRight");
    fireEvent.change(subBox(), { target: { value: "fu" } });
    subBox().setSelectionRange(1, 1);
    key(subBox(), "ArrowLeft");
    expect(document.activeElement).toBe(subBox());
    subBox().setSelectionRange(0, 0);
    key(subBox(), "ArrowLeft");
    expect(document.activeElement).toBe(box);
    expect(highlighted()).toBe("Apple");
    // The query is still the submenu's, by parent.
    expect(subTexts()).toEqual(["Fuji"]);

    key(box, "ArrowRight");
    expect(highlighted()).toBe("Fuji");
    key(subBox(), "Escape");
    expect(document.activeElement).toBe(box);
    expect(highlighted()).toBe("Apple");
    expect(screen.getByRole("listbox", { name: "Fruit" })).toBeTruthy();
    expect(ids(onHighlight)).toEqual([
      "apple",
      "apple:gala",
      "apple:fuji",
      "apple",
      "apple:fuji",
      "apple",
    ]);
  });

  it("takes the keys when the pointer enters the submenu, and gives them back when it leaves", () => {
    render(<Harness />);
    const box = open();
    const apple = screen.getByRole("option", { name: "Apple" });
    fireEvent.pointerMove(apple);
    expect(document.activeElement).toBe(box);
    const surface = screen
      .getByRole("listbox", { name: "Apple varieties" })
      .closest('[data-slot="popover-content"]') as HTMLElement;
    fireEvent.pointerEnter(surface);
    expect(document.activeElement).toBe(subBox());
    fireEvent.pointerMove(screen.getByRole("option", { name: "Fuji" }));
    expect(highlighted()).toBe("Fuji");
    fireEvent.change(subBox(), { target: { value: "g" } });
    expect(highlighted()).toBe("Gala");

    // Back over the parent row.
    fireEvent.pointerLeave(surface, { relatedTarget: apple });
    fireEvent.pointerMove(apple);
    expect(document.activeElement).toBe(box);
    expect(highlighted()).toBe("Apple");

    // Out of the submenu altogether: it closes, and focus is not lost.
    fireEvent.pointerEnter(surface);
    expect(document.activeElement).toBe(subBox());
    fireEvent.pointerLeave(surface, { relatedTarget: document.body });
    expect(
      screen.queryByRole("listbox", { name: "Apple varieties" }),
    ).toBeNull();
    expect(document.activeElement).toBe(box);
  });

  it("stays open under a tap, whose leave is the finger lifting", () => {
    render(<Harness />);
    open();
    fireEvent.click(
      screen
        .getByRole("option", { name: "Apple" })
        .querySelector('[data-slot="submenu-trigger"]') as HTMLElement,
    );
    const surface = screen
      .getByRole("listbox", { name: "Apple varieties" })
      .closest('[data-slot="popover-content"]') as HTMLElement;
    fireEvent.pointerEnter(surface, { pointerType: "touch" });
    fireEvent.pointerLeave(surface, {
      pointerType: "touch",
      relatedTarget: null,
    });
    expect(
      screen.getByRole("listbox", { name: "Apple varieties" }),
    ).toBeTruthy();
    subBox().focus();
    expect(document.activeElement).toBe(subBox());
  });

  it("keeps the height it had before the filter, so it does not slide off the pointer", () => {
    render(<Harness />);
    const box = openApple();
    key(box, "ArrowRight");
    const surface = screen
      .getByRole("listbox", { name: "Apple varieties" })
      .closest('[data-slot="popover-content"]') as HTMLElement;
    expect(surface.style.minHeight).toBe("");
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 240, height: 180 }),
    );
    fireEvent.change(subBox(), { target: { value: "f" } });
    fireEvent.change(subBox(), { target: { value: "fu" } });
    expect(surface.style.minHeight).toBe(
      "min(180px, var(--radix-popover-content-available-height))",
    );
  });

  it("takes the keys when its box is clicked, and a press on a row keeps them there", () => {
    render(<Harness />);
    const box = openApple();
    expect(fireEvent.mouseDown(subBox())).toBe(true);
    subBox().focus();
    expect(document.activeElement).toBe(subBox());
    expect(
      fireEvent.mouseDown(screen.getByRole("option", { name: "Fuji" })),
    ).toBe(false);
    box.focus();
    expect(highlighted()).toBe("Apple");
  });

  it("starts every opening with the submenu unfiltered", async () => {
    render(<Harness />);
    let box = openApple();
    key(box, "ArrowRight");
    fireEvent.change(subBox(), { target: { value: "fu" } });
    key(subBox(), "Tab");
    await waitFor(() =>
      expect(screen.queryByRole("listbox", { name: "Fruit" })).toBeNull(),
    );
    box = openApple();
    expect(subBox().value).toBe("");
    expect(subTexts()).toEqual(["Gala", "Fuji", "Braeburn", "Crab"]);
  });

  it("asks for the unfiltered rows to tell which rows have a submenu", () => {
    const getSubmenu = vi.fn((row: Row, q: string) =>
      VARIETIES[row.id]?.filter((v) => matchText(v.label, q)),
    );
    render(<Harness getSubmenu={getSubmenu} />);
    const box = openApple();
    key(box, "ArrowRight");
    fireEvent.change(subBox(), { target: { value: "zzz" } });
    // Filtered to nothing, Apple is still a row with a submenu.
    expect(
      screen
        .getByRole("option", { name: "Apple" })
        .getAttribute("aria-haspopup"),
    ).toBe("listbox");
    expect(getSubmenu).toHaveBeenCalledWith(ROWS[0], "zzz");
    expect(getSubmenu).toHaveBeenCalledWith(ROWS[0], "");
  });
});
