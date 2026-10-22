import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useMemo, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FilterMenu,
  type FilterMenuSection,
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
    { id: "apple:crab", label: "Crab", disabled: true },
  ],
  plum: [{ id: "plum:damson", label: "Damson" }],
};

function Harness({
  selectedId = "pear",
  selectedSubmenuId,
  onHighlight,
  onSelect = () => {},
}: {
  selectedId?: string;
  selectedSubmenuId?: string;
  onHighlight?: (row: Row | null) => void;
  onSelect?: (row: Row) => void;
}) {
  const [query, setQuery] = useState("");
  const sections = useMemo<FilterMenuSection<Row>[]>(
    () => [
      {
        id: "fruit",
        rows: ROWS.filter((row) => matchText(row.label, query)),
      },
    ],
    [query],
  );
  return (
    <FilterMenu
      query={query}
      onQueryChange={setQuery}
      sections={sections}
      selectedId={selectedId}
      selectedSubmenuId={selectedSubmenuId}
      getSubmenu={(row) => VARIETIES[row.id]}
      submenuLabel={(row) => `${row.label} varieties`}
      onHighlight={onHighlight}
      onSelect={onSelect}
      renderRow={(row) => row.label}
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

function highlighted() {
  const id = screen.getByRole("combobox").getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.textContent : undefined;
}

function key(el: HTMLElement, k: string) {
  fireEvent.keyDown(el, { key: k });
}

const ids = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls.map(([row]) => (row as Row | null)?.id ?? null);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("FilterMenu submenus", () => {
  it("opens the highlighted row's submenu as its own listbox", () => {
    render(<Harness selectedSubmenuId="apple:fuji" />);
    const box = open();
    const apple = screen.getByRole("option", { name: "Apple" });
    expect(apple.getAttribute("aria-haspopup")).toBe("listbox");
    expect(apple.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen
        .getByRole("option", { name: "Pear" })
        .hasAttribute("aria-haspopup"),
    ).toBe(false);
    expect(
      screen.queryByRole("listbox", { name: "Apple varieties" }),
    ).toBeNull();

    key(box, "ArrowUp");
    expect(apple.getAttribute("aria-expanded")).toBe("true");
    const sub = screen.getByRole("listbox", { name: "Apple varieties" });
    const options = [...sub.querySelectorAll('[role="option"]')];
    expect(options.map((o) => o.textContent)).toEqual(["Gala", "Fuji", "Crab"]);
    expect(
      options
        .filter((o) => o.hasAttribute("data-selected"))
        .map((o) => o.textContent),
    ).toEqual(["Fuji"]);
    // The parent's check is the list's; selectedSubmenuId does not check it.
    expect(apple.hasAttribute("data-selected")).toBe(false);
    expect(highlighted()).toBe("Apple");
  });

  it("enters with → only at the end of the query, and walks within the submenu", () => {
    const onHighlight = vi.fn();
    render(<Harness onHighlight={onHighlight} />);
    const box = open();
    fireEvent.change(box, { target: { value: "ap" } });
    expect(highlighted()).toBe("Apple");
    (box as HTMLInputElement).setSelectionRange(0, 0);
    key(box, "ArrowRight");
    expect(highlighted()).toBe("Apple");
    (box as HTMLInputElement).setSelectionRange(2, 2);
    key(box, "ArrowRight");
    expect(highlighted()).toBe("Gala");
    const parent = screen.getByRole("option", { name: "Apple" });
    expect(parent.hasAttribute("data-highlighted")).toBe(true);
    expect(parent.getAttribute("aria-selected")).toBe("false");
    key(box, "ArrowDown");
    expect(highlighted()).toBe("Fuji");
    // Crab is disabled, and the walk does not wrap or leave the submenu.
    key(box, "ArrowDown");
    expect(highlighted()).toBe("Fuji");
    key(box, "Home");
    expect(highlighted()).toBe("Gala");
    key(box, "End");
    expect(highlighted()).toBe("Fuji");
    key(box, "ArrowLeft");
    expect(highlighted()).toBe("Apple");
    expect(ids(onHighlight)).toEqual([
      "apple",
      "apple:gala",
      "apple:fuji",
      "apple:gala",
      "apple:fuji",
      "apple",
    ]);
  });

  it("goes back to the parent on Escape, and closes on the next", async () => {
    const onHighlight = vi.fn();
    render(<Harness onHighlight={onHighlight} />);
    const box = open();
    key(box, "ArrowUp");
    key(box, "ArrowRight");
    expect(highlighted()).toBe("Gala");
    key(box, "Escape");
    expect(highlighted()).toBe("Apple");
    expect(screen.getByRole("listbox", { name: "Fruit" })).toBeTruthy();
    key(box, "Escape");
    expect(screen.queryByRole("listbox", { name: "Fruit" })).toBeNull();
    expect(onHighlight.mock.calls.at(-1)?.[0]).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Pick" }),
      ),
    );
  });

  it("closes on Escape with the submenu open but the highlight in the list", () => {
    render(<Harness />);
    const box = open();
    key(box, "ArrowUp");
    expect(
      screen.getByRole("listbox", { name: "Apple varieties" }),
    ).toBeTruthy();
    key(box, "Escape");
    expect(screen.queryByRole("listbox", { name: "Fruit" })).toBeNull();
  });

  it("picks a submenu row with Enter or a click", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    let box = open();
    key(box, "ArrowUp");
    key(box, "ArrowRight");
    key(box, "ArrowDown");
    key(box, "Enter");
    expect(onSelect).toHaveBeenLastCalledWith(VARIETIES.apple?.[1]);
    expect(screen.queryByRole("listbox")).toBeNull();

    box = open();
    key(box, "ArrowDown");
    expect(highlighted()).toBe("Plum");
    const damson = screen.getByRole("option", { name: "Damson" });
    expect(fireEvent.mouseDown(damson)).toBe(false);
    fireEvent.click(damson);
    expect(onSelect).toHaveBeenLastCalledWith(VARIETIES.plum?.[0]);
  });

  it("highlights submenu rows under the pointer, and leaving into the submenu reports no null", () => {
    const onHighlight = vi.fn();
    render(<Harness onHighlight={onHighlight} />);
    open();
    const apple = screen.getByRole("option", { name: "Apple" });
    fireEvent.pointerMove(apple);
    const fuji = screen.getByRole("option", { name: "Fuji" });
    fireEvent.pointerLeave(screen.getByRole("listbox", { name: "Fruit" }), {
      relatedTarget: fuji,
    });
    expect(highlighted()).toBe("Apple");
    fireEvent.pointerMove(fuji);
    expect(highlighted()).toBe("Fuji");
    // Back onto the parent row moves the highlight out of the submenu.
    fireEvent.pointerMove(apple);
    expect(highlighted()).toBe("Apple");
    fireEvent.pointerMove(fuji);
    const surface = screen
      .getByRole("listbox", { name: "Apple varieties" })
      .closest('[data-slot="popover-content"]') as HTMLElement;
    fireEvent.pointerLeave(surface, { relatedTarget: document.body });
    expect(highlighted()).toBeUndefined();
    expect(ids(onHighlight)).toEqual([
      "apple",
      "apple:fuji",
      "apple",
      "apple:fuji",
      null,
    ]);
  });

  it("keeps the parent highlighted across rows crossed toward the submenu, for 300 ms", () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const onHighlight = vi.fn();
    render(<Harness onHighlight={onHighlight} />);
    open();
    const apple = screen.getByRole("option", { name: "Apple" });
    const pear = screen.getByRole("option", { name: "Pear" });
    fireEvent.pointerMove(apple);
    const surface = screen
      .getByRole("listbox", { name: "Apple varieties" })
      .closest('[data-slot="popover-content"]') as HTMLElement;
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 200, y: 0, width: 150, height: 200 }),
    );

    fireEvent.pointerLeave(apple, {
      clientX: 100,
      clientY: 10,
      relatedTarget: pear,
    });
    fireEvent.pointerMove(pear, { clientX: 150, clientY: 30 });
    expect(highlighted()).toBe("Apple");
    // Off the triangle: the crossed row takes the highlight.
    fireEvent.pointerMove(pear, { clientX: 20, clientY: 40 });
    expect(highlighted()).toBe("Pear");

    fireEvent.pointerMove(apple);
    fireEvent.pointerLeave(apple, {
      clientX: 100,
      clientY: 10,
      relatedTarget: pear,
    });
    vi.advanceTimersByTime(301);
    fireEvent.pointerMove(pear, { clientX: 150, clientY: 30 });
    expect(highlighted()).toBe("Pear");
    expect(ids(onHighlight)).toEqual(["apple", "pear", "apple", "pear"]);
  });

  it("lets a pointer moving straight down the list take the next row", () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    render(<Harness />);
    open();
    const apple = screen.getByRole("option", { name: "Apple" });
    const pear = screen.getByRole("option", { name: "Pear" });
    fireEvent.pointerMove(apple);
    const surface = screen
      .getByRole("listbox", { name: "Apple varieties" })
      .closest('[data-slot="popover-content"]') as HTMLElement;
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 200, y: 0, width: 150, height: 200 }),
    );
    fireEvent.pointerLeave(apple, {
      clientX: 100,
      clientY: 20,
      relatedTarget: pear,
    });
    // Inside the triangle's lower edge, but not heading for the submenu.
    fireEvent.pointerMove(pear, { clientX: 100, clientY: 22 });
    expect(highlighted()).toBe("Pear");
  });

  it("keeps heading for the submenu through a sample with no sideways movement", () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    render(<Harness />);
    open();
    const apple = screen.getByRole("option", { name: "Apple" });
    const pear = screen.getByRole("option", { name: "Pear" });
    fireEvent.pointerMove(apple);
    const surface = screen
      .getByRole("listbox", { name: "Apple varieties" })
      .closest('[data-slot="popover-content"]') as HTMLElement;
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 200, y: 0, width: 150, height: 200 }),
    );
    fireEvent.pointerLeave(apple, {
      clientX: 100,
      clientY: 10,
      relatedTarget: pear,
    });
    fireEvent.pointerMove(pear, { clientX: 140, clientY: 30 });
    fireEvent.pointerMove(pear, { clientX: 140, clientY: 32 });
    expect(highlighted()).toBe("Apple");
  });

  it("opens a submenu only for a highlight the user moved", () => {
    render(<Harness selectedId="apple" />);
    open();
    expect(highlighted()).toBe("Apple");
    expect(
      screen.queryByRole("listbox", { name: "Apple varieties" }),
    ).toBeNull();
    key(screen.getByRole("combobox"), "ArrowRight");
    expect(highlighted()).toBe("Gala");
  });

  it("keeps the highlight across the gap, and drops it when the pointer never arrives", () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const onHighlight = vi.fn();
    render(<Harness onHighlight={onHighlight} />);
    open();
    const apple = screen.getByRole("option", { name: "Apple" });
    const list = screen.getByRole("listbox", { name: "Fruit" });
    fireEvent.pointerEnter(list);
    fireEvent.pointerMove(apple);
    const surface = screen
      .getByRole("listbox", { name: "Apple varieties" })
      .closest('[data-slot="popover-content"]') as HTMLElement;
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 200, y: 0, width: 150, height: 200 }),
    );
    // Out of the row and the list at once, into the gap before the submenu.
    fireEvent.pointerLeave(apple, {
      clientX: 190,
      clientY: 20,
      relatedTarget: document.body,
    });
    expect(highlighted()).toBe("Apple");
    act(() => vi.advanceTimersByTime(300));
    expect(highlighted()).toBeUndefined();
    expect(ids(onHighlight)).toEqual(["apple", null]);
  });
});
