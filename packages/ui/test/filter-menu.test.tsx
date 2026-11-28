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
  type FilterMenuSelectEvent,
  MatchedText,
  matchText,
} from "../src/components/filter-menu.tsx";
import { POINTER_FINE } from "../src/hooks/use-media-query.ts";

/** What a pick under single selection carries. */
const PICKED = expect.objectContaining({ selected: true });

interface Fruit {
  id: string;
  label: string;
  disabled?: boolean;
  action?: boolean;
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
  countLabel,
}: {
  selectedId?: string;
  onHighlight?: (row: Fruit | null) => void;
  onSelect?: (row: Fruit) => void;
  nuts?: Fruit[];
  handle?: React.Ref<FilterMenuHandle>;
  countLabel?: (count: number) => string;
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
        countLabel={countLabel}
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

/** What the status regions say, whichever of the two holds it. */
function said() {
  return screen
    .queryAllByRole("status")
    .map((el) => el.textContent)
    .join("");
}

afterEach(() => {
  vi.useRealTimers();
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
    expect(onSelect).toHaveBeenCalledWith(NUTS[0], PICKED);
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
    expect(onSelect).toHaveBeenCalledWith(FRUIT[1], PICKED);
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

  it("leaves the focus with a menu its pick opens", async () => {
    function Steps() {
      const [second, setSecond] = useState(false);
      return (
        <>
          <FilterMenu
            query=""
            onQueryChange={() => {}}
            onSelect={() => setSecond(true)}
            sections={[{ id: "all", rows: FRUIT }]}
            renderRow={(row) => row.label}
            inputLabel="Filter fruit"
          >
            <button type="button">Fruit</button>
          </FilterMenu>
          <FilterMenu
            open={second}
            onOpenChange={setSecond}
            query=""
            onQueryChange={() => {}}
            sections={[{ id: "all", rows: NUTS }]}
            renderRow={(row) => row.label}
            inputLabel="Filter nuts"
          >
            <button type="button">Nuts</button>
          </FilterMenu>
        </>
      );
    }
    render(<Steps />);
    fireEvent.click(screen.getByRole("button", { name: "Fruit" }));
    fireEvent.click(screen.getByRole("option", { name: "Apple" }));
    const box = screen.getByRole("combobox", { name: "Filter nuts" });
    expect(document.activeElement).toBe(box);
    // Past the zero-delay timer in which Radix hands the first menu's focus back.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(document.activeElement).toBe(box);
    expect(screen.getByRole("listbox").textContent).toContain("Almond");
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

describe("FilterMenu status", () => {
  it("tells a screen reader how many rows typing left, once it rests", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Harness />);
    const box = open();
    act(() => vi.advanceTimersByTime(1000));
    expect(said()).toBe("");
    fireEvent.change(box, { target: { value: "p" } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.change(box, { target: { value: "pe" } });
    act(() => vi.advanceTimersByTime(499));
    expect(said()).toBe("");
    act(() => vi.advanceTimersByTime(1));
    expect(options()).toEqual(["Pear", "Frappé", "Pecan"]);
    expect(said()).toBe("3 results");
    fireEvent.change(box, { target: { value: "pea" } });
    act(() => vi.advanceTimersByTime(500));
    expect(said()).toBe("1 result");
  });

  it("speaks the empty state's words when no rows are left", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Harness />);
    fireEvent.change(open(), { target: { value: "kiwi" } });
    act(() => vi.advanceTimersByTime(500));
    expect(said()).toBe('No matches for "kiwi"');
  });

  it("speaks the same count again after a letter that keeps it", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Harness />);
    const box = open();
    const regions = () =>
      screen.getAllByRole("status").map((el) => el.textContent);
    fireEvent.change(box, { target: { value: "ap" } });
    act(() => vi.advanceTimersByTime(500));
    const first = regions();
    fireEvent.change(box, { target: { value: "app" } });
    act(() => vi.advanceTimersByTime(500));
    expect(said()).toBe("2 results");
    expect(regions()).toEqual([...first].reverse());
  });

  it("waits for rows that arrive after the query", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const props = {
      onQueryChange: () => {},
      onSelect: () => {},
      renderRow: (row: Fruit) => row.label,
      inputLabel: "Filter fruit",
    };
    const menu = (query: string, rows: Fruit[]) => (
      <FilterMenu {...props} query={query} sections={[{ id: "all", rows }]}>
        <button type="button">Pick</button>
      </FilterMenu>
    );
    const { rerender } = render(menu("", FRUIT));
    fireEvent.change(open(), { target: { value: "pe" } });
    rerender(menu("pe", FRUIT));
    act(() => vi.advanceTimersByTime(300));
    rerender(menu("pe", [FRUIT[1] as Fruit]));
    act(() => vi.advanceTimersByTime(300));
    expect(said()).toBe("");
    act(() => vi.advanceTimersByTime(200));
    expect(said()).toBe("1 result");
  });

  it("starts silent at the next opening", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Harness />);
    const box = open();
    fireEvent.change(box, { target: { value: "pe" } });
    act(() => vi.advanceTimersByTime(500));
    expect(said()).toBe("3 results");
    key(box, "Escape");
    open();
    act(() => vi.advanceTimersByTime(1000));
    expect(said()).toBe("");
  });

  it("words the count with countLabel", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Harness countLabel={(n) => `${n} fruit left`} />);
    fireEvent.change(open(), { target: { value: "pe" } });
    act(() => vi.advanceTimersByTime(500));
    expect(said()).toBe("3 fruit left");
  });
});

describe("FilterMenu picks under single selection", () => {
  /** A ref picker's shape: a region row completes the box, a city picks. */
  function Completing({
    onSelect,
  }: {
    onSelect?: (row: Fruit, event: FilterMenuSelectEvent) => void;
  }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [extra, setExtra] = useState<Fruit[]>([]);
    const rows = useMemo(
      () =>
        [
          { id: "nuts:", label: "Nuts…", action: true },
          ...extra,
          ...FRUIT,
          ...NUTS,
        ].filter((row) => matchText(row.label, query.replace(/^nuts:/, ""))),
      [query, extra],
    );
    return (
      <>
        <FilterMenu
          open={open}
          onOpenChange={setOpen}
          query={query}
          onQueryChange={setQuery}
          sections={[{ id: "all", rows }]}
          renderRow={(row) => row.label}
          onSelect={(row, event) => {
            onSelect?.(row, event);
            if (row.id === "nuts:") {
              event.preventDefault();
              setQuery("nuts:");
            } else if (row.id === "pear") {
              // Waits for something, then closes the menu itself.
              event.preventDefault();
              setExtra([{ id: "apricot", label: "Apricot" }]);
            }
          }}
          inputLabel="Filter fruit"
        >
          <button type="button">Pick</button>
        </FilterMenu>
        <button type="button" onClick={() => setOpen(false)}>
          Done
        </button>
      </>
    );
  }

  it("tells a pick it asks for the row selected", () => {
    const onSelect = vi.fn();
    render(<Completing onSelect={onSelect} />);
    const box = open();
    fireEvent.change(box, { target: { value: "alm" } });
    key(box, "Enter");
    const [row, event] = onSelect.mock.calls[0] ?? [];
    expect(row).toBe(NUTS[0]);
    expect(event).toMatchObject({ selected: true, defaultPrevented: false });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("stays open on a pick whose default is prevented, its focus, query and highlight as they were", () => {
    const onSelect = vi.fn();
    render(<Completing onSelect={onSelect} />);
    const box = open();
    fireEvent.change(box, { target: { value: "p" } });
    expect(highlighted()).toBe("Apple");
    key(box, "ArrowDown");
    key(box, "Enter");
    expect(onSelect.mock.calls[0]?.[1]).toMatchObject({
      selected: true,
      defaultPrevented: true,
    });
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(document.activeElement).toBe(box);
    expect(box).toHaveProperty("value", "p");
    // A row arrived ahead of it, which a first hit's highlight would take.
    expect(options()[0]).toBe("Apricot");
    expect(highlighted()).toBe("Pear");
  });

  it("follows a query the pick sets to its first hit, then closes through open as any close", async () => {
    render(<Completing />);
    const box = open();
    key(box, "ArrowDown");
    expect(highlighted()).toBe("Nuts…");
    key(box, "Enter");
    expect(box).toHaveProperty("value", "nuts:");
    expect(highlighted()).toBe("Nuts…");
    fireEvent.change(box, { target: { value: "nuts:pe" } });
    expect(highlighted()).toBe("Pear");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("listbox")).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Pick" }),
      ),
    );
  });

  it("draws no check on an action row, even one named as selected, and closes on it", () => {
    const onSelect = vi.fn();
    function Plain() {
      return (
        <FilterMenu
          query=""
          onQueryChange={() => {}}
          sections={[
            {
              id: "all",
              rows: [
                { id: "new", label: "New fruit…", action: true },
                ...FRUIT,
              ],
            },
          ]}
          selectedId="new"
          renderRow={(row, state) => `${row.label}${state.selected ? "*" : ""}`}
          onSelect={onSelect}
          inputLabel="Filter fruit"
        >
          <button type="button">Pick</button>
        </FilterMenu>
      );
    }
    render(<Plain />);
    open();
    const action = screen.getByRole("option", { name: "New fruit…" });
    expect(action.hasAttribute("data-selected")).toBe(false);
    expect(action.querySelector("svg")).toBeNull();
    fireEvent.click(action);
    expect(onSelect.mock.calls[0]?.[1]).toMatchObject({ selected: true });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

/** A touch screen's primary pointer, which is not fine. */
function stubTouchScreen() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query !== POINTER_FINE,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe("FilterMenu without a fine pointer", () => {
  it("opens with the focus on the list, so no on-screen keyboard rises", () => {
    stubTouchScreen();
    render(<Harness selectedId="pear" />);
    const box = open();
    expect(document.activeElement).toBe(
      screen.getByRole("listbox", { name: "Fruit" }),
    );
    expect(highlighted()).toBe("Pear");
    // A tap on a row leaves the focus there; one on the box moves it in.
    const apple = screen.getByRole("option", { name: "Apple" });
    fireEvent.pointerDown(apple, { pointerType: "touch" });
    expect(fireEvent.mouseDown(apple)).toBe(false);
    expect(fireEvent.mouseDown(box)).toBe(true);
  });

  it("asks a data-pointer ancestor before the primary pointer", () => {
    const { unmount } = render(
      <div data-pointer="coarse">
        <Harness />
      </div>,
    );
    open();
    expect(document.activeElement).toBe(screen.getByRole("listbox"));
    unmount();

    stubTouchScreen();
    render(
      <div data-pointer="fine">
        <Harness />
      </div>,
    );
    const box = open();
    expect(document.activeElement).toBe(box);
  });

  it("hands a hardware keyboard's keys from the list to the box", () => {
    stubTouchScreen();
    const onSelect = vi.fn();
    render(<Harness selectedId="pear" onSelect={onSelect} />);
    const box = open();
    const list = screen.getByRole("listbox", { name: "Fruit" });

    // Neither types nor moves anything.
    key(list, "Shift");
    key(list, "a", { ctrlKey: true });
    expect(document.activeElement).toBe(list);

    // A character is left to the browser, to type where the focus now is.
    expect(fireEvent.keyDown(list, { key: "a" })).toBe(true);
    expect(document.activeElement).toBe(box);

    act(() => list.focus());
    key(list, "ArrowDown");
    expect(document.activeElement).toBe(box);
    expect(highlighted()).toBe("Frappé");

    act(() => list.focus());
    key(list, "Enter");
    expect(onSelect).toHaveBeenCalledWith(FRUIT[3], PICKED);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on Tab from the list, moving focus past the trigger", async () => {
    stubTouchScreen();
    render(<Harness />);
    open();
    key(screen.getByRole("listbox"), "Tab");
    expect(screen.queryByRole("listbox")).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "after" }),
      ),
    );
  });
});
