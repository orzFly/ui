import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createRef, useMemo, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FilterMenu,
  type FilterMenuHandle,
  type FilterMenuSection,
  MatchedText,
  matchText,
} from "../src/components/filter-menu.tsx";

interface Fruit {
  id: string;
  label: string;
  disabled?: boolean;
}

const FRUIT: Fruit[] = [
  { id: "apple", label: "Apple" },
  { id: "pear", label: "Pear" },
  { id: "plum", label: "Plum", disabled: true },
  { id: "frappe", label: "Frappé" },
];
const NUTS: Fruit[] = [
  { id: "almond", label: "Almond" },
  { id: "pecan", label: "Pecan" },
];

function Harness({
  selectedId,
  onHighlight,
  onSelect = () => {},
  nuts = NUTS,
  handle,
}: {
  selectedId?: string;
  onHighlight?: (row: Fruit | null) => void;
  onSelect?: (row: Fruit) => void;
  nuts?: Fruit[];
  handle?: React.Ref<FilterMenuHandle>;
}) {
  const [query, setQuery] = useState("");
  const sections = useMemo<FilterMenuSection<Fruit>[]>(() => {
    const keep = (rows: Fruit[]) =>
      rows.filter((row) => matchText(row.label, query));
    return [
      { id: "fruit", label: "Fruit", rows: keep(FRUIT) },
      { id: "nuts and seeds", label: "Nuts", rows: keep(nuts) },
    ];
  }, [query, nuts]);
  return (
    <>
      <button type="button">before</button>
      <FilterMenu
        ref={handle}
        query={query}
        onQueryChange={setQuery}
        sections={sections}
        selectedId={selectedId}
        onHighlight={onHighlight}
        onSelect={onSelect}
        renderRow={(row) => <MatchedText text={row.label} query={query} />}
        inputLabel="Filter fruit"
        listLabel="Fruit"
      >
        <button type="button">Pick</button>
      </FilterMenu>
      <button type="button">after</button>
    </>
  );
}

function open() {
  const trigger = screen.getByRole("button", { name: "Pick" });
  fireEvent.click(trigger);
  return screen.getByRole("combobox", { name: "Filter fruit" });
}

function options() {
  return screen.queryAllByRole("option").map((el) => el.textContent);
}

function highlighted() {
  const box = screen.getByRole("combobox");
  const id = box.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.textContent : undefined;
}

function key(el: HTMLElement, k: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(el, { key: k, ...init });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** ResizeObservers by the element they watch, to fire one by hand. */
function stubResizeObserver() {
  const watching = new Map<Element, ResizeObserverCallback>();
  const disconnected: Element[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      #callback: ResizeObserverCallback;
      #targets: Element[] = [];
      constructor(callback: ResizeObserverCallback) {
        this.#callback = callback;
      }
      observe(target: Element) {
        this.#targets.push(target);
        watching.set(target, this.#callback);
      }
      unobserve() {}
      disconnect() {
        disconnected.push(...this.#targets);
      }
    },
  );
  const resize = (target: Element) =>
    act(() => watching.get(target)?.([], {} as ResizeObserver));
  return { resize, disconnected };
}

describe("matchText", () => {
  it("folds case and diacritics, and maps the range back", () => {
    expect(matchText("Frappé Latte", "FRAPPE")).toEqual({ start: 0, end: 6 });
    expect(matchText("Café", "fe")).toEqual({ start: 2, end: 4 });
    // A decomposed é: the mark stays inside the range.
    expect(matchText("Café!", "e")).toEqual({ start: 3, end: 5 });
    expect(matchText("Apple", "x")).toBeNull();
    expect(matchText("Apple", "")).toEqual({ start: 0, end: 0 });
    // Σ at a word's end lowers to ς, a lone one to σ.
    expect(matchText("ΟΔΟΣ", "ΟΔΟΣ")).toEqual({ start: 0, end: 4 });
    expect(matchText("ΟΔΟΣ", "ος")).toEqual({ start: 2, end: 4 });
  });

  it("marks the match in MatchedText", () => {
    const { container } = render(<MatchedText text="Frappé" query="ppe" />);
    expect(container.querySelector("mark")?.textContent).toBe("ppé");
    expect(container.textContent).toBe("Frappé");
  });
});

describe("FilterMenu", () => {
  it("opens focused in the filter box, wired as a combobox over labelled groups", () => {
    render(<Harness selectedId="pear" />);
    const box = open();
    expect(document.activeElement).toBe(box);
    const list = screen.getByRole("listbox", { name: "Fruit" });
    expect(box.getAttribute("aria-controls")).toBe(list.id);
    expect(box.getAttribute("aria-expanded")).toBe("true");
    const groups = screen.getAllByRole("group").map((g) => {
      const label = g.getAttribute("aria-labelledby") ?? "";
      return document.getElementById(label)?.textContent;
    });
    expect(groups).toEqual(["Fruit", "Nuts"]);
    expect(highlighted()).toBe("Pear");
    expect(
      screen
        .getAllByRole("option")
        .filter((o) => o.hasAttribute("data-selected"))
        .map((o) => o.textContent),
    ).toEqual(["Pear"]);
  });

  it("walks the highlight without wrapping, skipping disabled rows", () => {
    const onHighlight = vi.fn();
    render(<Harness selectedId="pear" onHighlight={onHighlight} />);
    const box = open();
    expect(onHighlight).not.toHaveBeenCalled();
    key(box, "ArrowDown");
    expect(highlighted()).toBe("Frappé");
    key(box, "ArrowUp");
    expect(highlighted()).toBe("Pear");
    key(box, "ArrowUp");
    key(box, "ArrowUp");
    expect(highlighted()).toBe("Apple");
    key(box, "End");
    expect(highlighted()).toBe("Pecan");
    key(box, "ArrowDown");
    expect(highlighted()).toBe("Pecan");
    key(box, "Home");
    expect(highlighted()).toBe("Apple");
    expect(onHighlight.mock.calls.map(([row]) => row?.id)).toEqual([
      "frappe",
      "pear",
      "apple",
      "pecan",
      "apple",
    ]);
  });

  it("highlights the first hit while typing, and rests on the committed row when cleared", () => {
    const onHighlight = vi.fn();
    render(<Harness selectedId="pear" onHighlight={onHighlight} />);
    const box = open();
    fireEvent.change(box, { target: { value: "p" } });
    expect(options()).toEqual(["Apple", "Pear", "Plum", "Frappé", "Pecan"]);
    expect(highlighted()).toBe("Apple");
    fireEvent.change(box, { target: { value: "pec" } });
    expect(options()).toEqual(["Pecan"]);
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(highlighted()).toBe("Pecan");
    fireEvent.change(box, { target: { value: "" } });
    expect(highlighted()).toBe("Pear");
    expect(onHighlight.mock.calls.map(([row]) => row?.id ?? null)).toEqual([
      "apple",
      "pecan",
      null,
    ]);
  });

  it("finds diacritics folded and says when nothing matches", () => {
    render(<Harness />);
    const box = open();
    fireEvent.change(box, { target: { value: "frappe" } });
    expect(options()).toEqual(["Frappé"]);
    fireEvent.change(box, { target: { value: "kiwi" } });
    expect(options()).toEqual([]);
    expect(screen.getByText('No matches for "kiwi"')).toBeTruthy();
    expect(box.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("picks with Enter and closes, starting unfiltered next time", () => {
    const onSelect = vi.fn();
    const onHighlight = vi.fn();
    render(<Harness onSelect={onSelect} onHighlight={onHighlight} />);
    let box = open();
    fireEvent.change(box, { target: { value: "alm" } });
    key(box, "Enter");
    expect(onSelect).toHaveBeenCalledWith(NUTS[0]);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onHighlight.mock.calls.at(-1)?.[0]).toBeNull();

    box = open();
    expect(box).toHaveProperty("value", "");
    expect(options()).toHaveLength(6);
  });

  it("does nothing on Enter with no highlight", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    key(open(), "Enter");
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("highlights under the pointer, clears on leave, and picks on click", () => {
    const onSelect = vi.fn();
    const onHighlight = vi.fn();
    render(
      <Harness
        selectedId="apple"
        onSelect={onSelect}
        onHighlight={onHighlight}
      />,
    );
    const box = open();
    const pear = screen.getByRole("option", { name: "Pear" });
    fireEvent.pointerMove(pear);
    expect(highlighted()).toBe("Pear");
    fireEvent.pointerMove(screen.getByRole("option", { name: "Plum" }));
    expect(highlighted()).toBe("Pear");
    fireEvent.pointerLeave(screen.getByRole("listbox"));
    expect(highlighted()).toBeUndefined();
    expect(onHighlight.mock.calls.map(([row]) => row?.id ?? null)).toEqual([
      "pear",
      null,
    ]);

    // The press would take focus out of the box.
    const down = fireEvent.mouseDown(pear);
    expect(down).toBe(false);
    fireEvent.click(screen.getByRole("option", { name: "Plum" }));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(pear);
    expect(onSelect).toHaveBeenCalledWith(FRUIT[1]);
    expect(document.activeElement).not.toBe(box);
  });

  it("closes on Escape, focusing the trigger", async () => {
    const onHighlight = vi.fn();
    render(<Harness onHighlight={onHighlight} />);
    const box = open();
    key(box, "ArrowDown");
    key(box, "Escape");
    expect(screen.queryByRole("listbox")).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Pick" }),
      ),
    );
    expect(onHighlight.mock.calls.at(-1)?.[0]).toBeNull();
  });

  it("closes on Tab, moving focus past the trigger either way", async () => {
    render(<Harness />);
    key(open(), "Tab");
    expect(screen.queryByRole("listbox")).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "after" }),
      ),
    );
    key(open(), "Tab", { shiftKey: true });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "before" }),
      ),
    );
  });

  it("drops a highlighted row that leaves the list, and keeps one that stays", () => {
    const onHighlight = vi.fn();
    const { rerender } = render(<Harness onHighlight={onHighlight} />);
    const box = open();
    key(box, "End");
    expect(highlighted()).toBe("Pecan");
    rerender(
      <Harness
        onHighlight={onHighlight}
        nuts={[NUTS[1] as Fruit, NUTS[0] as Fruit]}
      />,
    );
    expect(highlighted()).toBe("Pecan");
    rerender(<Harness onHighlight={onHighlight} nuts={[NUTS[0] as Fruit]} />);
    expect(highlighted()).toBeUndefined();
    expect(onHighlight.mock.calls.at(-1)?.[0]).toBeNull();
  });

  it("puts the highlight back on the committed row through its handle", () => {
    const onHighlight = vi.fn();
    const handle = createRef<FilterMenuHandle>();
    render(
      <Harness selectedId="pear" onHighlight={onHighlight} handle={handle} />,
    );
    const box = open();
    key(box, "Home");
    expect(highlighted()).toBe("Apple");
    act(() => handle.current?.resetHighlight());
    expect(highlighted()).toBe("Pear");
    expect(onHighlight.mock.calls.map(([row]) => row?.id ?? null)).toEqual([
      "apple",
      null,
    ]);
  });

  it("opens from the trigger with the arrow keys", () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Pick" }), {
      key: "ArrowDown",
    });
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("keeps focus in the box when the surface around it is pressed", () => {
    render(<Harness />);
    const box = open();
    const icon = box.parentElement?.querySelector("svg") as SVGElement;
    expect(fireEvent.mouseDown(icon)).toBe(false);
    expect(fireEvent.mouseDown(box)).toBe(true);
  });

  it("finds the committed row in rows that arrive after opening", () => {
    const sections = (rows: Fruit[]): FilterMenuSection<Fruit>[] => [
      { id: "all", rows },
    ];
    const props = {
      query: "",
      onQueryChange: () => {},
      onSelect: () => {},
      selectedId: "pear",
      renderRow: (row: Fruit) => row.label,
      inputLabel: "Filter fruit",
    };
    const { rerender } = render(
      <FilterMenu {...props} sections={sections([])}>
        <button type="button">Pick</button>
      </FilterMenu>,
    );
    open();
    expect(highlighted()).toBeUndefined();
    rerender(
      <FilterMenu {...props} sections={sections(FRUIT)}>
        <button type="button">Pick</button>
      </FilterMenu>,
    );
    expect(highlighted()).toBe("Pear");
  });

  it("scrolls the committed row into view once the list takes its size", () => {
    const { resize, disconnected } = stubResizeObserver();
    const scrolled: (string | null)[] = [];
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(
      function (this: HTMLElement) {
        scrolled.push(this.textContent);
      },
    );
    render(<Harness selectedId="pecan" />);
    open();
    const list = screen.getByRole("listbox", { name: "Fruit" });
    scrolled.length = 0;
    // Mounted, then placed: the list gets its height a step after opening.
    resize(list);
    expect(scrolled).toEqual(["Pecan"]);

    // Once the user scrolls the list, a page scroll's resize leaves it be.
    fireEvent.wheel(list);
    resize(list);
    expect(scrolled).toEqual(["Pecan"]);

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(disconnected).toContain(list);
  });

  it("follows a filter that lags the query to its new first hit", () => {
    const onHighlight = vi.fn();
    const props = {
      onQueryChange: () => {},
      onSelect: () => {},
      onHighlight,
      renderRow: (row: Fruit) => row.label,
      inputLabel: "Filter fruit",
    };
    const menu = (query: string, rows: Fruit[]) => (
      <FilterMenu {...props} query={query} sections={[{ id: "all", rows }]}>
        <button type="button">Pick</button>
      </FilterMenu>
    );
    const { rerender } = render(menu("", FRUIT));
    open();
    rerender(menu("pe", FRUIT));
    expect(highlighted()).toBe("Apple");
    rerender(menu("pe", [FRUIT[1] as Fruit]));
    expect(highlighted()).toBe("Pear");
    expect(onHighlight.mock.calls.map(([row]) => row?.id)).toEqual([
      "apple",
      "pear",
    ]);
  });

  it("resets and reports a controlled open the parent flips", () => {
    const onHighlight = vi.fn();
    const onQueryChange = vi.fn();
    const menu = (isOpen: boolean, query: string) => (
      <FilterMenu
        open={isOpen}
        query={query}
        onQueryChange={onQueryChange}
        onSelect={() => {}}
        onHighlight={onHighlight}
        sections={[{ id: "all", rows: FRUIT }]}
        renderRow={(row) => row.label}
        inputLabel="Filter fruit"
      >
        <button type="button">Pick</button>
      </FilterMenu>
    );
    const { rerender } = render(menu(true, ""));
    key(screen.getByRole("combobox"), "ArrowDown");
    expect(onHighlight.mock.calls.at(-1)?.[0]).toBe(FRUIT[0]);
    rerender(menu(false, "pe"));
    expect(onHighlight.mock.calls.at(-1)?.[0]).toBeNull();
    rerender(menu(true, "pe"));
    expect(onQueryChange).toHaveBeenLastCalledWith("");
  });
});
