import { act, fireEvent, render, screen } from "@testing-library/react";
import { type ComponentProps, useMemo, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FilterMenu,
  type FilterMenuSection,
  matchText,
} from "../src/components/filter-menu.tsx";
import { isPlainClick } from "../src/lib/link.ts";

/** What a pick under single selection carries. */
const PICKED = expect.objectContaining({ selected: true });

interface Place {
  id: string;
  label: string;
  disabled?: boolean;
}

// Inbox is no place: it stays an option of its own.
const PROJECTS: Place[] = [
  { id: "atlas", label: "Atlas" },
  { id: "beacon", label: "Beacon" },
  { id: "cobalt", label: "Cobalt", disabled: true },
  { id: "inbox", label: "Inbox" },
];
const BOARDS: Record<string, Place[]> = {
  atlas: [
    { id: "atlas/q3", label: "Q3" },
    { id: "atlas/q4", label: "Q4" },
  ],
};

/**
 * A router's link, as TanStack Router's and React Router's are: the caller's
 * `onClick` first, then a plain click nobody handled goes in place.
 */
function RouterLink({
  to,
  go,
  onClick,
  ...props
}: ComponentProps<"a"> & { to: string; go: (to: string) => void }) {
  return (
    <a
      href={to}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!isPlainClick(event)) return;
        event.preventDefault();
        go(to);
      }}
    />
  );
}

function Harness({
  onSelect,
  go,
  submenus = false,
}: {
  onSelect?: (row: Place) => void;
  /** Given, the rows are a router's links; else their `href`s. */
  go?: (to: string) => void;
  submenus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const sections = useMemo<FilterMenuSection<Place>[]>(
    () => [
      {
        id: "projects",
        rows: PROJECTS.filter((row) => matchText(row.label, query)),
      },
    ],
    [query],
  );
  return (
    <FilterMenu
      query={query}
      onQueryChange={setQuery}
      sections={sections}
      selectedId="beacon"
      onSelect={onSelect}
      rowLink={(row) => {
        if (row.id === "inbox") return undefined;
        const to = `/projects/${row.id}`;
        return go ? <RouterLink to={to} go={go} /> : to;
      }}
      getSubmenu={submenus ? (row) => BOARDS[row.id] : undefined}
      submenuLabel={(row) => `${row.label} boards`}
      renderRow={(row) => row.label}
      inputLabel="Filter projects"
      listLabel="Projects"
    >
      <button type="button">Project</button>
    </FilterMenu>
  );
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: "Project" }));
  return screen.getByRole("combobox", { name: "Filter projects" });
}

const row = (name: string) => screen.getByRole("option", { name });
const isOpen = () => screen.queryByRole("listbox", { name: "Projects" });

// Whether the page took the last click over, and the element it landed on,
// read once every handler in it has run; then the click is stopped short of
// happy-dom's navigation.
let tookOver: boolean | undefined;
let clicked: EventTarget | null;
const stop = (event: MouseEvent) => {
  tookOver = event.defaultPrevented;
  clicked = event.target;
  event.preventDefault();
};
beforeEach(() => {
  tookOver = undefined;
  clicked = null;
  window.addEventListener("click", stop);
});
afterEach(() => {
  window.removeEventListener("click", stop);
  vi.restoreAllMocks();
});

describe("FilterMenu link rows", () => {
  it("draws a row that is a place as its link, still an option of the listbox", () => {
    render(<Harness />);
    const box = open();
    const atlas = row("Atlas");
    expect(atlas.tagName).toBe("A");
    expect(atlas.getAttribute("href")).toBe("/projects/atlas");
    expect(atlas.tabIndex).toBe(-1);
    expect(row("Inbox").tagName).toBe("DIV");

    fireEvent.keyDown(box, { key: "Home" });
    expect(box.getAttribute("aria-activedescendant")).toBe(atlas.id);
    expect(atlas.getAttribute("aria-selected")).toBe("true");
    expect(atlas.hasAttribute("data-highlighted")).toBe(true);
  });

  it("goes by the link on a plain click, and closes", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    open();
    fireEvent.click(row("Atlas"));
    // Left to the browser, which follows the link.
    expect(tookOver).toBe(false);
    expect(onSelect).toHaveBeenCalledWith(PROJECTS[0], PICKED);
    expect(isOpen()).toBeNull();
  });

  it("goes by a router's link on a plain click, and closes", () => {
    const go = vi.fn();
    const onSelect = vi.fn();
    render(<Harness go={go} onSelect={onSelect} />);
    open();
    fireEvent.click(row("Atlas"));
    expect(go).toHaveBeenCalledWith("/projects/atlas");
    expect(tookOver).toBe(true);
    expect(onSelect).toHaveBeenCalledWith(PROJECTS[0], PICKED);
    expect(isOpen()).toBeNull();
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["⌘", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["Alt", { altKey: true }],
    ["the middle button", { button: 1 }],
  ])("leaves a click with %s to the browser, the menu open", (_, init) => {
    const go = vi.fn();
    const onSelect = vi.fn();
    render(<Harness go={go} onSelect={onSelect} />);
    open();
    fireEvent.click(row("Atlas"), init);
    expect(tookOver).toBe(false);
    expect(go).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(isOpen()).toBeTruthy();
  });

  it("goes by the link on Enter, as a plain click does", () => {
    const go = vi.fn();
    const onSelect = vi.fn();
    render(<Harness go={go} onSelect={onSelect} />);
    const box = open();
    fireEvent.keyDown(box, { key: "Home" });
    const atlas = row("Atlas");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(clicked).toBe(atlas);
    expect(tookOver).toBe(true);
    expect(go).toHaveBeenCalledWith("/projects/atlas");
    expect(onSelect).toHaveBeenCalledWith(PROJECTS[0], PICKED);
    expect(isOpen()).toBeNull();
  });

  it("clicks a plain link on Enter, for the browser to follow", () => {
    render(<Harness />);
    const box = open();
    fireEvent.keyDown(box, { key: "Home" });
    const atlas = row("Atlas");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(clicked).toBe(atlas);
    expect(tookOver).toBe(false);
    expect(isOpen()).toBeNull();
  });

  it("picks a row that is no place on Enter and on a click, as before", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const box = open();
    fireEvent.keyDown(box, { key: "End" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith(PROJECTS[3], PICKED);
    open();
    fireEvent.click(row("Inbox"), { ctrlKey: true });
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(isOpen()).toBeNull();
  });

  it("goes nowhere from a disabled link row", () => {
    const go = vi.fn();
    const onSelect = vi.fn();
    render(<Harness go={go} onSelect={onSelect} />);
    open();
    fireEvent.click(row("Cobalt"));
    expect(tookOver).toBe(true);
    expect(go).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(isOpen()).toBeTruthy();
  });

  it("lets the mouse's press on a link row take the focus, for a drag, and gives it back to the box", () => {
    render(<Harness />);
    const box = open();
    const atlas = row("Atlas");

    fireEvent.pointerDown(atlas, { pointerType: "mouse" });
    expect(fireEvent.mouseDown(atlas)).toBe(true);
    // What the browser does with a press it was left.
    act(() => atlas.focus());
    fireEvent.mouseUp(atlas);
    expect(document.activeElement).toBe(box);

    fireEvent.pointerDown(atlas, { pointerType: "mouse" });
    expect(fireEvent.mouseDown(atlas)).toBe(true);
    act(() => atlas.focus());
    fireEvent.dragStart(atlas);
    fireEvent.dragEnd(atlas);
    expect(document.activeElement).toBe(box);
  });

  it("gives a drag's focus back to the list where the menu opened on it", () => {
    render(
      <div data-pointer="coarse">
        <Harness />
      </div>,
    );
    open();
    const list = screen.getByRole("listbox", { name: "Projects" });
    expect(document.activeElement).toBe(list);
    const atlas = row("Atlas");
    fireEvent.pointerDown(atlas, { pointerType: "mouse" });
    expect(fireEvent.mouseDown(atlas)).toBe(true);
    act(() => atlas.focus());
    fireEvent.mouseUp(atlas);
    // Not the box, which would raise the on-screen keyboard.
    expect(document.activeElement).toBe(list);
  });

  it("keeps the focus in the box for any other press on a row", () => {
    render(<Harness />);
    open();
    const atlas = row("Atlas");
    fireEvent.pointerDown(atlas, { pointerType: "touch" });
    expect(fireEvent.mouseDown(atlas)).toBe(false);
    fireEvent.pointerDown(atlas, { pointerType: "mouse" });
    expect(fireEvent.mouseDown(atlas, { button: 1 })).toBe(false);
    expect(fireEvent.mouseDown(atlas, { button: 2 })).toBe(false);
    fireEvent.pointerDown(row("Inbox"), { pointerType: "mouse" });
    expect(fireEvent.mouseDown(row("Inbox"))).toBe(false);
  });

  it("opens a link row's submenu from its chevron without going", () => {
    const go = vi.fn();
    const onSelect = vi.fn();
    render(<Harness go={go} onSelect={onSelect} submenus />);
    open();
    const chevron = row("Atlas").querySelector(
      '[data-slot="submenu-trigger"]',
    ) as HTMLElement;
    expect(fireEvent.click(chevron)).toBe(false);
    expect(go).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox", { name: "Atlas boards" })).toBeTruthy();
  });

  it("draws a submenu's rows that are places as links too", () => {
    const go = vi.fn();
    const onSelect = vi.fn();
    render(<Harness go={go} onSelect={onSelect} submenus />);
    open();
    fireEvent.pointerMove(row("Atlas"));
    const q3 = row("Q3");
    expect(q3.tagName).toBe("A");
    fireEvent.click(q3, { metaKey: true });
    expect(isOpen()).toBeTruthy();
    fireEvent.click(q3);
    expect(go).toHaveBeenCalledWith("/projects/atlas/q3");
    expect(onSelect).toHaveBeenCalledWith(BOARDS.atlas?.[0], PICKED);
    expect(isOpen()).toBeNull();
  });
});
