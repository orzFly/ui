import { act, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../src/components/dropdown-menu.tsx";
import { POINTER_FINE } from "../src/hooks/use-media-query.ts";

interface Project {
  slug: string;
  name: string;
  disabled?: boolean;
}

const PROJECTS: Project[] = [
  { slug: "atlas", name: "Atlas" },
  { slug: "beacon", name: "Beacon" },
  { slug: "cinder", name: "Cinder", disabled: true },
  { slug: "delta", name: "Delta" },
  { slug: "ember", name: "Ember" },
];

function Harness({
  onQueryChange,
  onEscapeKeyDown,
  onRowClick,
  onRowSelect,
  empty,
  countLabel,
  filtering = true,
  extra,
}: {
  onQueryChange?: (query: string) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  onRowClick?: (event: React.MouseEvent) => void;
  onRowSelect?: (event: Event) => void;
  empty?: (query: string) => ReactNode;
  countLabel?: (count: number) => string;
  filtering?: boolean;
  extra?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const shown = PROJECTS.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );
  const rows = shown.map((p) => (
    <DropdownMenuItem
      key={p.slug}
      disabled={p.disabled}
      asChild
      onSelect={onRowSelect}
    >
      <a href={`#${p.slug}`} onClick={onRowClick}>
        {p.name}
      </a>
    </DropdownMenuItem>
  ));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Copy</DropdownMenuItem>
        <DropdownMenuItem>Delete</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Move to project</DropdownMenuSubTrigger>
          {filtering ? (
            <DropdownMenuSubContent
              query={query}
              onQueryChange={(next) => {
                onQueryChange?.(next);
                setQuery(next);
              }}
              onEscapeKeyDown={onEscapeKeyDown}
              empty={empty}
              countLabel={countLabel}
            >
              {rows}
              {extra}
            </DropdownMenuSubContent>
          ) : (
            <DropdownMenuSubContent>{rows}</DropdownMenuSubContent>
          )}
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function stubPointer(fine: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === POINTER_FINE ? fine : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => stubPointer(true));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const trigger = () => screen.getByRole("menuitem", { name: "Move to project" });
const box = () =>
  screen.getByRole("combobox", { name: "Filter" }) as HTMLInputElement;
const option = (name: string) => screen.getByRole("option", { name });
/** What the status regions say, whichever of the two holds it. */
const said = () =>
  screen
    .queryAllByRole("status")
    .map((el) => el.textContent)
    .join("");
const highlighted = () =>
  document.getElementById(box().getAttribute("aria-activedescendant") ?? "")
    ?.textContent ?? null;

function openMenu() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Actions" }), {
    button: 0,
    pointerType: "mouse",
  });
  return screen.getByRole("menu");
}

/** Opens the submenu as a mouse resting on its trigger does. */
function hoverOpen() {
  openMenu();
  fireEvent.pointerMove(trigger(), { pointerType: "mouse" });
  act(() => vi.advanceTimersByTime(100));
}

/** Opens the submenu from the keyboard, as → on its trigger does. */
function keyOpen(key = "ArrowRight") {
  openMenu();
  const at = trigger();
  at.focus();
  fireEvent.keyDown(at, { key });
}

describe("DropdownMenuSubContent without a query", () => {
  it("stays a menu of menu items, which Escape closes whole", () => {
    render(<Harness filtering={false} />);
    keyOpen();
    expect(screen.getAllByRole("menu")).toHaveLength(2);
    expect(screen.getByRole("menuitem", { name: "Atlas" })).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(trigger().getAttribute("aria-haspopup")).toBe("menu");
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("DropdownMenuSubContent with a query: entering from the keyboard", () => {
  it.each(["ArrowRight", "Enter", " "])(
    "puts the focus in the box on %j, the first row highlighted",
    (key) => {
      render(<Harness />);
      keyOpen(key);
      expect(document.activeElement).toBe(box());
      expect(highlighted()).toBe("Atlas");
      expect(box().getAttribute("aria-activedescendant")).toBe(
        option("Atlas").id,
      );
    },
  );
});

describe("DropdownMenuSubContent with a query: typing", () => {
  it("filters, keeps the focus in the box and highlights the first match", () => {
    const onQueryChange = vi.fn();
    render(<Harness onQueryChange={onQueryChange} />);
    keyOpen();
    fireEvent.change(box(), { target: { value: "e" } });
    expect(onQueryChange).toHaveBeenLastCalledWith("e");
    expect(document.activeElement).toBe(box());
    // Cinder matches too, but is disabled.
    expect(highlighted()).toBe("Beacon");
  });

  it("never jumps to a row by its first letter", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Harness />);
    keyOpen();
    expect(fireEvent.keyDown(box(), { key: "d" })).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(document.activeElement).toBe(box());
    // Delta, taking the focus, would have taken the highlight with it.
    expect(highlighted()).toBe("Atlas");
  });
});

describe("DropdownMenuSubContent with a query: keys in the box", () => {
  it("walks the enabled rows without wrapping", () => {
    render(<Harness />);
    keyOpen();
    const walk = (key: string) => {
      fireEvent.keyDown(box(), { key });
      return highlighted();
    };
    expect(walk("ArrowDown")).toBe("Beacon");
    expect(walk("ArrowDown")).toBe("Delta");
    expect(walk("ArrowDown")).toBe("Ember");
    expect(walk("ArrowDown")).toBe("Ember");
    expect(walk("ArrowUp")).toBe("Delta");
    expect(walk("Home")).toBe("Atlas");
    expect(walk("ArrowUp")).toBe("Atlas");
    expect(walk("End")).toBe("Ember");
    expect(document.activeElement).toBe(box());
  });

  it("starts from either end when nothing is highlighted", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Harness />);
    hoverOpen();
    act(() => vi.advanceTimersByTime(500));
    expect(document.activeElement).toBe(box());
    expect(box().getAttribute("aria-activedescendant")).toBeNull();
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    expect(highlighted()).toBe("Atlas");
    fireEvent.pointerMove(option("Delta"), { pointerType: "mouse" });
    fireEvent.pointerLeave(option("Delta"), { pointerType: "mouse" });
    expect(box().getAttribute("aria-activedescendant")).toBeNull();
    fireEvent.keyDown(box(), { key: "ArrowUp" });
    expect(highlighted()).toBe("Ember");
  });

  it("clicks the highlighted link on Enter, which closes the menu", () => {
    const clicked: string[] = [];
    render(
      <Harness
        onRowClick={(event) => {
          clicked.push(event.currentTarget.textContent ?? "");
        }}
      />,
    );
    keyOpen();
    fireEvent.keyDown(box(), { key: "ArrowDown" });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(clicked).toEqual(["Beacon"]);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes the menu on Enter when the link's click is a router's", () => {
    render(<Harness onRowClick={(event) => event.preventDefault()} />);
    keyOpen();
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("leaves a modified click on a link row to the browser, the menu open", () => {
    render(<Harness />);
    keyOpen();
    fireEvent.click(option("Delta"), { ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("selects a plain row on Enter, unless its onSelect prevents it", () => {
    const onSelect = vi.fn();
    const { unmount } = render(
      <Harness
        extra={
          <DropdownMenuItem onSelect={onSelect}>Elsewhere</DropdownMenuItem>
        }
      />,
    );
    keyOpen();
    fireEvent.keyDown(box(), { key: "End" });
    expect(highlighted()).toBe("Elsewhere");
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    unmount();

    render(
      <Harness
        extra={
          <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
            Elsewhere
          </DropdownMenuItem>
        }
      />,
    );
    keyOpen();
    fireEvent.keyDown(box(), { key: "End" });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("does nothing on Enter with nothing highlighted, or mid-composition", () => {
    const onRowClick = vi.fn();
    render(<Harness onRowClick={onRowClick} />);
    keyOpen();
    fireEvent.keyDown(box(), { key: "Enter", isComposing: true });
    fireEvent.change(box(), { target: { value: "zz" } });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(onRowClick).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("closes the submenu on the arrow back only from the start of the box", () => {
    render(<Harness />);
    keyOpen();
    fireEvent.change(box(), { target: { value: "at" } });
    box().setSelectionRange(2, 2);
    fireEvent.keyDown(box(), { key: "ArrowLeft" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    box().setSelectionRange(0, 0);
    fireEvent.keyDown(box(), { key: "ArrowLeft" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(document.activeElement).toBe(trigger());
  });

  it("closes the submenu alone on Escape, the focus back on its trigger", () => {
    render(<Harness />);
    keyOpen();
    fireEvent.keyDown(box(), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(document.activeElement).toBe(trigger());
  });

  it("leaves an Escape that ends a composition to the IME", () => {
    render(<Harness />);
    keyOpen();
    fireEvent.keyDown(box(), { key: "Escape", isComposing: true });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.activeElement).toBe(box());
  });

  it("stays open when the caller's onEscapeKeyDown prevents it", () => {
    render(<Harness onEscapeKeyDown={(event) => event.preventDefault()} />);
    keyOpen();
    fireEvent.keyDown(box(), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("menu")).toBeTruthy();
  });
});

describe("DropdownMenuSubContent with a query: the pointer", () => {
  it("gives the box the focus once a hover-opened submenu has waited 500 ms", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Harness />);
    hoverOpen();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.activeElement).toBe(trigger());
    act(() => vi.advanceTimersByTime(499));
    expect(document.activeElement).toBe(trigger());
    act(() => vi.advanceTimersByTime(1));
    expect(document.activeElement).toBe(box());
  });

  it("restarts the wait when a click puts the focus back on the trigger", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Harness />);
    hoverOpen();
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerDown(trigger(), { pointerType: "mouse" });
    fireEvent.click(trigger());
    expect(document.activeElement).toBe(trigger());
    act(() => vi.advanceTimersByTime(499));
    expect(document.activeElement).toBe(trigger());
    act(() => vi.advanceTimersByTime(1));
    expect(document.activeElement).toBe(box());
  });

  it("never gives the box the focus by itself without a fine pointer", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // Opened by a tap.
    const { unmount } = render(<Harness />);
    openMenu();
    fireEvent.pointerDown(trigger(), { pointerType: "touch" });
    fireEvent.click(trigger());
    expect(screen.getByRole("dialog")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1000));
    expect(document.activeElement).toBe(trigger());
    unmount();

    // A coarse primary pointer, with a mouse that hovers.
    stubPointer(false);
    const second = render(<Harness />);
    hoverOpen();
    act(() => vi.advanceTimersByTime(1000));
    expect(document.activeElement).toBe(trigger());
    fireEvent.pointerEnter(screen.getByRole("dialog"), {
      pointerType: "mouse",
    });
    expect(document.activeElement).toBe(trigger());
    second.unmount();

    // A preview forcing touch sizing, as Storybook's toolbar does.
    stubPointer(true);
    document.documentElement.dataset.pointer = "coarse";
    try {
      render(<Harness />);
      hoverOpen();
      act(() => vi.advanceTimersByTime(1000));
      expect(document.activeElement).toBe(trigger());
    } finally {
      delete document.documentElement.dataset.pointer;
    }
  });

  it("gives the box the focus as soon as a mouse enters the submenu", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Harness />);
    hoverOpen();
    fireEvent.pointerEnter(screen.getByRole("dialog"), {
      pointerType: "touch",
    });
    expect(document.activeElement).toBe(trigger());
    fireEvent.pointerEnter(screen.getByRole("dialog"), {
      pointerType: "mouse",
    });
    expect(document.activeElement).toBe(box());
  });

  it("takes a letter typed on the trigger into the box, not the parent menu", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Harness />);
    hoverOpen();
    expect(document.activeElement).toBe(trigger());
    fireEvent.keyDown(trigger(), { key: "d" });
    act(() => vi.advanceTimersByTime(1000));
    expect(document.activeElement).toBe(box());
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("leaves Space on the trigger to Radix, which enters the submenu", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Harness />);
    hoverOpen();
    fireEvent.keyDown(trigger(), { key: " " });
    expect(document.activeElement).toBe(box());
    expect(box().value).toBe("");
    expect(highlighted()).toBe("Atlas");
  });

  it("keeps the focus in the box as the mouse moves over the trigger", () => {
    render(<Harness />);
    keyOpen();
    fireEvent.pointerMove(trigger(), { pointerType: "mouse" });
    expect(document.activeElement).toBe(box());
  });

  it("highlights the row under the mouse without moving the focus", () => {
    render(<Harness />);
    keyOpen();
    fireEvent.pointerMove(option("Delta"), { pointerType: "mouse" });
    expect(highlighted()).toBe("Delta");
    expect(option("Delta").hasAttribute("data-highlighted")).toBe(true);
    expect(document.activeElement).toBe(box());
    fireEvent.pointerLeave(option("Delta"), { pointerType: "mouse" });
    expect(box().getAttribute("aria-activedescendant")).toBeNull();
    expect(document.activeElement).toBe(box());
  });

  it("keeps presses off the focus, except a left press on a link with a mouse", () => {
    render(<Harness extra={<DropdownMenuItem>Elsewhere</DropdownMenuItem>} />);
    keyOpen();
    const plain = option("Elsewhere");
    fireEvent.pointerDown(plain, { pointerType: "mouse" });
    expect(fireEvent.mouseDown(plain, { button: 0 })).toBe(false);
    const list = screen.getByRole("listbox");
    expect(fireEvent.mouseDown(list, { button: 0 })).toBe(false);
    expect(fireEvent.mouseDown(box(), { button: 0 })).toBe(true);

    const link = option("Delta");
    fireEvent.pointerDown(link, { pointerType: "touch" });
    expect(fireEvent.mouseDown(link, { button: 0 })).toBe(false);
    fireEvent.pointerDown(link, { pointerType: "mouse" });
    expect(fireEvent.mouseDown(link, { button: 2 })).toBe(false);
    fireEvent.pointerDown(link, { pointerType: "mouse" });
    expect(fireEvent.mouseDown(link, { button: 0 })).toBe(true);
    // The browser focuses the link it may drag; the release hands it back.
    link.focus();
    expect(document.activeElement).toBe(link);
    fireEvent.mouseUp(window);
    expect(document.activeElement).toBe(box());
  });
});

describe("DropdownMenuSubContent with a query: what it shows", () => {
  it("shows the empty state where the rows go when there are none", () => {
    render(<Harness />);
    keyOpen();
    expect(screen.queryByText(/No matches/)).toBeNull();
    fireEvent.change(box(), { target: { value: "zz" } });
    expect(screen.getByText('No matches for "zz"')).toBeTruthy();
    fireEvent.change(box(), { target: { value: "a" } });
    expect(screen.queryByText(/No matches/)).toBeNull();
  });

  it("tells a screen reader what typing left, once it rests", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Harness />);
    keyOpen();
    act(() => vi.advanceTimersByTime(1000));
    expect(said()).toBe("");
    fireEvent.change(box(), { target: { value: "e" } });
    act(() => vi.advanceTimersByTime(499));
    expect(said()).toBe("");
    act(() => vi.advanceTimersByTime(1));
    // Cinder is disabled, and still one of the options a screen reader counts.
    expect(said()).toBe("4 results");
    fireEvent.change(box(), { target: { value: "zz" } });
    act(() => vi.advanceTimersByTime(500));
    expect(said()).toBe('No matches for "zz"');
  });

  it("starts silent at the next opening", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Harness />);
    keyOpen();
    fireEvent.change(box(), { target: { value: "e" } });
    act(() => vi.advanceTimersByTime(500));
    expect(said()).toBe("4 results");
    fireEvent.keyDown(box(), { key: "Escape" });
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.keyDown(trigger(), { key: "ArrowRight" });
    act(() => vi.advanceTimersByTime(1000));
    expect(box().value).toBe("");
    expect(said()).toBe("");
  });

  it("words the count with countLabel", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Harness countLabel={(n) => `${n} projects`} />);
    keyOpen();
    fireEvent.change(box(), { target: { value: "a" } });
    act(() => vi.advanceTimersByTime(500));
    expect(said()).toBe("3 projects");
  });

  it("shows the caller's empty state", () => {
    render(<Harness empty={(query) => `No project matches "${query}"`} />);
    keyOpen();
    fireEvent.change(box(), { target: { value: "zz" } });
    expect(screen.getByText('No project matches "zz"')).toBeTruthy();
  });

  it("starts each opening unfiltered", () => {
    const onQueryChange = vi.fn();
    render(<Harness onQueryChange={onQueryChange} />);
    keyOpen();
    expect(onQueryChange).not.toHaveBeenCalled();
    fireEvent.change(box(), { target: { value: "be" } });
    fireEvent.keyDown(box(), { key: "Escape" });
    onQueryChange.mockClear();
    fireEvent.keyDown(trigger(), { key: "ArrowRight" });
    expect(onQueryChange).toHaveBeenCalledWith("");
    expect(box().value).toBe("");
    expect(screen.getAllByRole("option")).toHaveLength(PROJECTS.length);
  });

  it("names its parts for a screen reader", () => {
    render(
      <Harness
        extra={
          <DropdownMenuCheckboxItem checked>Pinned</DropdownMenuCheckboxItem>
        }
      />,
    );
    openMenu();
    expect(trigger().getAttribute("aria-haspopup")).toBe("dialog");
    fireEvent.keyDown(trigger(), { key: "ArrowRight" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(box().getAttribute("aria-expanded")).toBe("true");
    expect(box().getAttribute("aria-autocomplete")).toBe("list");
    const list = screen.getByRole("listbox", { name: "Move to project" });
    expect(box().getAttribute("aria-controls")).toBe(list.id);
    expect(option("Atlas").getAttribute("aria-selected")).toBe("true");
    expect(option("Beacon").getAttribute("aria-selected")).toBe("false");
    expect(option("Pinned").getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByRole("menuitem", { name: "Atlas" })).toBeNull();
  });
});
