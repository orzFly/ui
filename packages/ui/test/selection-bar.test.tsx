import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DropdownMenuItem } from "../src/components/dropdown-menu.tsx";
import { FilterMenu } from "../src/components/filter-menu.tsx";
import { SelectionBar } from "../src/components/selection-bar.tsx";
import {
  Toolbar,
  ToolbarButton,
  ToolbarItem,
  ToolbarLabel,
  ToolbarMenu,
  ToolbarOverflow,
} from "../src/components/toolbar.tsx";
import { stubToolbarLayout } from "./stub-toolbar-layout.ts";

let layout: ReturnType<typeof stubToolbarLayout>;
beforeEach(() => {
  layout = stubToolbarLayout(1000);
});
afterEach(() => layout.restore());

const Icon = () => <svg aria-hidden />;

const settle = () => act(async () => {});
/** A task later: Radix hands the focus back from a closed menu then. */
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

function Harness({ initial, total = 5 }: { initial: number; total?: number }) {
  const [count, setCount] = useState(initial);
  return (
    <SelectionBar
      aria-label="Inbox"
      count={count}
      total={total}
      onSelectAll={() => setCount(total)}
      onClear={() => setCount(0)}
      idle={
        <ToolbarItem flex minWidth={80}>
          <span className="truncate">Inbox</span>
        </ToolbarItem>
      }
    >
      <ToolbarButton aria-label="Archive">
        <Icon />
      </ToolbarButton>
    </SelectionBar>
  );
}

const checkbox = () => screen.getByRole("checkbox", { name: "Select all" });
const bar = () => screen.getByRole("toolbar", { name: "Inbox" });
const more = () =>
  document.querySelector<HTMLElement>("[data-slot=toolbar-overflow-trigger]");
const button = (name: string) =>
  screen.getByRole("button", { name, hidden: true });
const inMore = (name: string) =>
  button(name).closest("[data-overflowed]") !== null;
const precedes = (a: Element, b: Element) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("SelectionBar", () => {
  it("holds the idle content while nothing is selected", () => {
    render(<Harness initial={0} />);
    expect(screen.getByText("Inbox")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("shows the count, the actions and the clear button while selecting", () => {
    render(<Harness initial={2} />);
    expect(screen.getByRole("status").textContent).toBe("2 selected");
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
    expect(screen.queryByText("Inbox")).toBeNull();
    expect(checkbox().getAttribute("data-state")).toBe("indeterminate");
  });

  it("selects the rest from a partly checked box, and clears from a full one", () => {
    render(<Harness initial={2} />);
    fireEvent.click(checkbox());
    expect(screen.getByRole("status").textContent).toBe("5 selected");
    expect(checkbox().getAttribute("data-state")).toBe("checked");
    fireEvent.click(checkbox());
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("clears by its button and hands the focus to the checkbox", () => {
    render(<Harness initial={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.getByText("Inbox")).toBeTruthy();
    expect(document.activeElement).toBe(checkbox());
  });

  it("clears on Escape inside the bar", () => {
    render(<Harness initial={2} />);
    const action = screen.getByRole("button", { name: "Archive" });
    action.focus();
    fireEvent.keyDown(action, { key: "Escape" });
    expect(screen.getByRole("status").textContent).toBe("");
    expect(document.activeElement).toBe(checkbox());
  });

  it("disables select-all over an empty list", () => {
    render(<Harness initial={0} total={0} />);
    expect(checkbox().hasAttribute("disabled")).toBe(true);
  });

  it("is a toolbar of the caller's name, its row as tall as the box before it is measured", () => {
    render(<Harness initial={0} />);
    expect(bar().getAttribute("data-slot")).toBe("selection-bar");
    expect(bar().className).toContain("[--toolbar-row-cap:2rem]");
    expect(bar().className).toContain(
      "touch:[--toolbar-row-cap:max(2rem,var(--spacing-field-touch))]",
    );
  });

  it("never reuses a part of one state as the part of the other at its place", async () => {
    function Swap() {
      const [count, setCount] = useState(0);
      return (
        <SelectionBar
          aria-label="Inbox"
          count={count}
          total={5}
          onSelectAll={() => setCount(5)}
          onClear={() => setCount(0)}
          idle={
            <ToolbarButton aria-label="Refresh">
              <Icon />
            </ToolbarButton>
          }
        >
          <ToolbarButton aria-label="Archive">
            <Icon />
          </ToolbarButton>
        </SelectionBar>
      );
    }
    render(<Swap />);
    await settle();
    const refresh = button("Refresh");
    fireEvent.click(checkbox());
    await settle();
    expect(refresh.isConnected).toBe(false);
    expect(button("Archive")).not.toBe(refresh);
  });
});

describe("SelectionBar with an icon", () => {
  it("lets the checkbox stand in for the icon while the pointer is on the bar", () => {
    render(
      <SelectionBar
        count={0}
        total={3}
        onSelectAll={() => {}}
        onClear={() => {}}
        icon={<svg data-testid="clip" />}
        idle={<span>Files</span>}
      />,
    );
    const slot = checkbox().closest("[data-slot=select-slot]");
    expect(slot?.contains(screen.getByTestId("clip"))).toBe(true);
    expect(slot?.hasAttribute("data-revealed")).toBe(false);
    const bar = screen.getByText("Files").closest("[data-slot=selection-bar]");
    if (!bar) throw new Error("no bar");
    fireEvent.pointerEnter(bar, { pointerType: "mouse" });
    expect(slot?.hasAttribute("data-revealed")).toBe(true);
    fireEvent.pointerLeave(bar, { pointerType: "mouse" });
    expect(slot?.hasAttribute("data-revealed")).toBe(false);
    // A tap reveals nothing: on touch the icon is what is pressed.
    fireEvent.pointerEnter(bar, { pointerType: "touch" });
    expect(slot?.hasAttribute("data-revealed")).toBe(false);
  });

  it("puts the box the icon hides in the arrow-key order", async () => {
    render(
      <SelectionBar
        aria-label="Files"
        count={0}
        total={3}
        onSelectAll={() => {}}
        onClear={() => {}}
        icon={<svg data-testid="clip" />}
        idle={
          <ToolbarButton aria-label="Download all">
            <Icon />
          </ToolbarButton>
        }
      />,
    );
    await settle();
    act(() => screen.getByRole("toolbar", { name: "Files" }).focus());
    expect(document.activeElement).toBe(checkbox());
    expect(checkbox().tabIndex).toBe(0);
  });
});

const ROWS = ["a", "b", "c", "d", "e"];

/**
 * A list's bar: a title, a command and a ⋯ of its own while idle; while
 * selecting, actions that use the selection up (Archive, Status's Done,
 * the label `spam`) and one that does not (Mark read).
 */
function Inbox({ markRead = true }: { markRead?: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const clear = () => setSelected([]);
  return (
    <>
      <SelectionBar
        aria-label="Inbox"
        count={selected.length}
        total={ROWS.length}
        onSelectAll={() => setSelected(ROWS)}
        onClear={clear}
        idle={
          <>
            <ToolbarItem flex minWidth={80}>
              <span className="truncate">Inbox</span>
            </ToolbarItem>
            <ToolbarButton aria-label="Refresh">
              <Icon />
            </ToolbarButton>
            <ToolbarOverflow>
              <DropdownMenuItem onSelect={() => setSelected(ROWS)}>
                Select every row
              </DropdownMenuItem>
            </ToolbarOverflow>
          </>
        }
      >
        <ToolbarButton aria-label="Archive" onClick={clear}>
          <Icon />
        </ToolbarButton>
        <ToolbarMenu icon={<Icon />} label="Status">
          <DropdownMenuItem onSelect={clear}>Done</DropdownMenuItem>
        </ToolbarMenu>
        <FilterMenu
          selection="multiple"
          selectedIds={labels}
          query={query}
          onQueryChange={setQuery}
          sections={[
            {
              id: "all",
              rows: [{ id: "bug" }, { id: "docs" }, { id: "spam" }],
            },
          ]}
          renderRow={(row) => row.id}
          onSelect={(row, event) => {
            setLabels((ids) =>
              event.selected
                ? [...ids, row.id]
                : ids.filter((id) => id !== row.id),
            );
            if (row.id === "spam") clear();
          }}
          listLabel="Labels"
          toolbarActive={labels.length > 0}
        >
          <ToolbarButton>
            <Icon />
            <ToolbarLabel>Labels</ToolbarLabel>
          </ToolbarButton>
        </FilterMenu>
        {markRead && (
          <ToolbarButton aria-label="Mark read">
            <Icon />
          </ToolbarButton>
        )}
      </SelectionBar>
      <button type="button" onClick={() => setSelected(["a", "b"])}>
        Select two
      </button>
      <button type="button" onClick={clear}>
        Clear from outside
      </button>
    </>
  );
}

/** Selects two rows from outside the bar, as a row's checkbox does. */
async function selectTwo() {
  fireEvent.click(screen.getByRole("button", { name: "Select two" }));
  await settle();
}

/** Opens the ⋯ menu as Enter does, and returns its items' text. */
async function openMore() {
  const trigger = more();
  if (!trigger) throw new Error("no ⋯");
  fireEvent.keyDown(trigger, { key: "Enter" });
  await settle();
  return [...document.querySelectorAll("[role=menu] [role^=menuitem]")].map(
    (item) => item.textContent,
  );
}

// Selecting, the bar holds the box 32, the count 70, Archive 28, Status 106
// (64 without its words), Labels 84 (28), Mark read 28 and Clear 28; idle,
// the box, empty (0), Inbox at its least 80, Refresh 28 and its own ⋯ 28.

describe("SelectionBar's parts as a toolbar's", () => {
  const arrow = async () => {
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "ArrowRight",
    });
    await tick();
    return document.activeElement;
  };

  it("is one Tab stop, the arrows going from the box past the actions and the ⋯ to Clear", async () => {
    render(<Inbox />);
    await settle();
    await selectTwo();
    await layout.resize(200);
    expect(bar().tabIndex).toBe(-1);
    expect(
      [...bar().querySelectorAll("button")].filter(
        (each) => each.tabIndex === 0,
      ),
    ).toEqual([checkbox()]);
    act(() => checkbox().focus());
    expect(await arrow()).toBe(button("Archive"));
    expect(await arrow()).toBe(more());
    expect(await arrow()).toBe(button("Clear selection"));
    expect(await arrow()).toBe(checkbox());
  });

  it("skips the box over an empty list", async () => {
    render(
      <SelectionBar
        aria-label="Files"
        count={0}
        total={0}
        onSelectAll={() => {}}
        onClear={() => {}}
        idle={
          <ToolbarButton aria-label="Upload">
            <Icon />
          </ToolbarButton>
        }
      />,
    );
    await settle();
    act(() => screen.getByRole("toolbar", { name: "Files" }).focus());
    expect(document.activeElement).toBe(button("Upload"));
  });

  it("moves the actions into the ⋯, standing after them, and keeps the box, the count and Clear", async () => {
    render(<Inbox />);
    await settle();
    await selectTwo();
    // Without words 278 wide, as is the bar with Mark read in the ⋯.
    await layout.resize(200);
    expect(inMore("Archive")).toBe(false);
    expect(["Status", "Labels", "Mark read"].map(inMore)).toEqual([
      true,
      true,
      true,
    ]);
    expect(inMore("Clear selection")).toBe(false);
    expect(checkbox().closest("[data-overflowed]")).toBeNull();
    const trigger = more();
    if (!trigger) throw new Error("no ⋯");
    expect(precedes(button("Archive"), trigger)).toBe(true);
    expect(precedes(trigger, button("Clear selection"))).toBe(true);
    expect(await openMore()).toEqual(["Status", "Labels", "Mark read"]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await tick();
    await layout.resize(1000);
    expect(more()).toBeNull();
    expect(["Archive", "Status", "Labels", "Mark read"].map(inMore)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it("lays the idle parts out as a toolbar's, its own ⋯ included", async () => {
    render(<Inbox />);
    await settle();
    await layout.resize(120);
    expect(inMore("Refresh")).toBe(true);
    expect(await openMore()).toEqual(["Refresh", "Select every row"]);
  });

  it("lets a multiple FilterMenu in the ⋯ take several picks, then hands the focus back to the ⋯", async () => {
    render(<Inbox />);
    await settle();
    await selectTwo();
    await layout.resize(200);
    expect(await openMore()).toContain("Labels");
    fireEvent.click(screen.getByRole("menuitem", { name: "Labels" }));
    await settle();
    await settle();
    const box = screen.getByRole("combobox", { name: "Filter" });
    expect(document.activeElement).toBe(box);
    fireEvent.click(screen.getByRole("option", { name: "bug" }));
    fireEvent.click(screen.getByRole("option", { name: "docs" }));
    await settle();
    expect(
      screen
        .getAllByRole("option")
        .map((el) => el.getAttribute("aria-checked")),
    ).toEqual(["true", "true", "false"]);
    fireEvent.keyDown(box, { key: "Escape" });
    await settle();
    await settle();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(more());
    expect(screen.getByRole("status").textContent).toBe("2 selected");
  });

  it("closes an action's open menu on Escape, and clears on the next", async () => {
    render(<Inbox />);
    await settle();
    await selectTwo();
    fireEvent.keyDown(button("Status"), { key: "Enter" });
    await settle();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await tick();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("2 selected");
    expect(document.activeElement).toBe(button("Status"));
    fireEvent.keyDown(button("Status"), { key: "Escape" });
    await settle();
    expect(screen.getByRole("status").textContent).toBe("");
    expect(document.activeElement).toBe(checkbox());
  });

  it("warns of a Toolbar given as its idle content", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <SelectionBar
        count={0}
        total={3}
        onSelectAll={() => {}}
        onClear={() => {}}
        idle={
          <Toolbar aria-label="Files">
            <ToolbarButton aria-label="Upload">
              <Icon />
            </ToolbarButton>
          </Toolbar>
        }
      />,
    );
    await settle();
    expect(
      warn.mock.calls.some(([message]) =>
        String(message).includes("another toolbar's row"),
      ),
    ).toBe(true);
    warn.mockRestore();
  });
});

describe("SelectionBar handing the focus to its box", () => {
  it("when an action clears the selection", async () => {
    render(<Inbox />);
    await settle();
    await selectTwo();
    const archive = button("Archive");
    act(() => archive.focus());
    fireEvent.click(archive);
    await settle();
    expect(screen.getByRole("status").textContent).toBe("");
    expect(document.activeElement).toBe(checkbox());
  });

  it("when an item of an action's menu clears it", async () => {
    render(<Inbox />);
    await settle();
    await selectTwo();
    fireEvent.keyDown(button("Status"), { key: "Enter" });
    await settle();
    fireEvent.click(screen.getByRole("menuitem", { name: "Done" }));
    await settle();
    expect(document.activeElement).toBe(checkbox());
    await tick();
    await tick();
    expect(document.activeElement).toBe(checkbox());
  });

  it("when an item of the ⋯ menu clears it, closing the menu", async () => {
    render(<Inbox />);
    await settle();
    await selectTwo();
    // Every action in the ⋯.
    await layout.resize(160);
    expect(await openMore()).toContain("Archive");
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive" }));
    await settle();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(checkbox());
    await tick();
    await tick();
    expect(document.activeElement).toBe(checkbox());
  });

  it("when a pick in a FilterMenu opened from the ⋯ clears it", async () => {
    render(<Inbox />);
    await settle();
    await selectTwo();
    await layout.resize(200);
    await openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: "Labels" }));
    await settle();
    await settle();
    fireEvent.click(screen.getByRole("option", { name: "spam" }));
    await settle();
    expect(screen.getByRole("status").textContent).toBe("");
    expect(document.activeElement).toBe(checkbox());
    await tick();
    await tick();
    expect(document.activeElement).toBe(checkbox());
  });

  it("when an item of the idle ⋯ menu selects every row, rather than leave it to the ⋯ of the other state", async () => {
    render(<Inbox />);
    await settle();
    await layout.resize(200);
    await openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: "Select every row" }));
    await settle();
    expect(screen.getByRole("status").textContent).toBe("5 selected");
    expect(more()).not.toBeNull();
    expect(document.activeElement).toBe(checkbox());
    await tick();
    await tick();
    expect(document.activeElement).toBe(checkbox());
  });

  it("not when the focus is outside the bar", async () => {
    render(<Inbox />);
    await settle();
    await selectTwo();
    const outside = screen.getByRole("button", { name: "Clear from outside" });
    act(() => button("Archive").focus());
    act(() => outside.focus());
    fireEvent.click(outside);
    await settle();
    expect(screen.getByRole("status").textContent).toBe("");
    expect(document.activeElement).toBe(outside);
  });

  it("not when the part that held it went earlier and the focus has moved on", async () => {
    const { rerender } = render(<Inbox />);
    await settle();
    await selectTwo();
    act(() => button("Mark read").focus());
    rerender(<Inbox markRead={false} />);
    await settle();
    const outside = screen.getByRole("button", { name: "Clear from outside" });
    act(() => outside.focus());
    fireEvent.click(outside);
    await settle();
    expect(screen.getByRole("status").textContent).toBe("");
    expect(document.activeElement).toBe(outside);
  });
});
