import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../src/components/dropdown-menu.tsx";
import { FilterMenu } from "../src/components/filter-menu.tsx";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../src/components/segmented-control.tsx";
import {
  SplitButton,
  SplitButtonAction,
  SplitButtonMenu,
} from "../src/components/split-button.tsx";
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarItem,
  ToolbarLabel,
  ToolbarMenu,
  ToolbarOverflow,
  ToolbarSearch,
  ToolbarSeparator,
  ToolbarSpacer,
  useToolbarItem,
} from "../src/components/toolbar.tsx";
import { stubToolbarLayout } from "./stub-toolbar-layout.ts";

let layout: ReturnType<typeof stubToolbarLayout>;
beforeEach(() => {
  layout = stubToolbarLayout(1000);
});
afterEach(() => layout.restore());

const Icon = () => <svg aria-hidden />;

const overflowed = (name: string) =>
  screen
    .getAllByRole("button", { hidden: true })
    .find(
      (el) => el.getAttribute("aria-label") === name || el.textContent === name,
    )
    ?.hasAttribute("data-overflowed");

const trigger = () =>
  document.querySelector<HTMLElement>("[data-slot=toolbar-overflow-trigger]");

const row = () =>
  document.querySelector<HTMLElement>("[data-slot=toolbar-row]");

/** Opens the ⋯ menu as Enter does, and returns its items' text. */
async function openMore() {
  const more = trigger();
  if (!more) throw new Error("no ⋯");
  fireEvent.keyDown(more, { key: "Enter" });
  await act(async () => {});
  return [...document.querySelectorAll("[role=menu] [role^=menuitem]")].map(
    (item) => item.textContent,
  );
}

const settle = () => act(async () => {});

function Commands() {
  return (
    <Toolbar aria-label="Commands">
      <ToolbarButton aria-label="Archive">
        <Icon />
      </ToolbarButton>
      <ToolbarButton aria-label="Delete">
        <Icon />
      </ToolbarButton>
      <ToolbarButton aria-label="Unread">
        <Icon />
      </ToolbarButton>
      <ToolbarButton aria-label="Snooze">
        <Icon />
      </ToolbarButton>
    </Toolbar>
  );
}

describe("Toolbar", () => {
  it("moves what does not fit into the ⋯ menu, from the end, and brings it back", async () => {
    render(<Commands />);
    await settle();
    expect(trigger()).toBeNull();
    // 4 × 28 = 112; at 90, two go and the ⋯ takes 28.
    await layout.resize(90);
    expect(overflowed("Archive")).toBe(false);
    expect(overflowed("Delete")).toBe(false);
    expect(overflowed("Unread")).toBe(true);
    expect(overflowed("Snooze")).toBe(true);
    expect(
      screen.getByRole("button", { name: "Snooze", hidden: true }),
    ).toHaveProperty("inert", true);
    expect(await openMore()).toEqual(["Unread", "Snooze"]);
    await layout.resize(1000);
    expect(trigger()).toBeNull();
    expect(overflowed("Snooze")).toBe(false);
  });

  it("holds one Tab stop for the bar", async () => {
    render(<Commands />);
    await settle();
    const bar = screen.getByRole("toolbar", { name: "Commands" });
    expect(bar.tabIndex).toBe(0);
    for (const button of screen.getAllByRole("button")) {
      expect(button.tabIndex).toBe(-1);
    }
  });

  it("hides labels on a fine pointer, keeping the button, its name and a tooltip", async () => {
    render(
      <Toolbar aria-label="Message">
        <ToolbarButton>
          <Icon />
          <ToolbarLabel>Reply</ToolbarLabel>
        </ToolbarButton>
        <ToolbarButton>
          <Icon />
          <ToolbarLabel>Forward</ToolbarLabel>
        </ToolbarButton>
      </Toolbar>,
    );
    await settle();
    const reply = screen.getByRole("button", { name: "Reply" });
    reply.focus();
    // Full: 20 + 16 + 6 + 35 = 77 and 91; with labels hidden, 28 each.
    await layout.resize(100);
    const after = screen.getByRole("button", { name: "Reply" });
    expect(after).toBe(reply);
    expect(document.activeElement).toBe(reply);
    expect(after.getAttribute("aria-label")).toBe("Reply");
    expect(after.dataset.size).toBe("icon");
    expect(
      after
        .querySelector("[data-slot=toolbar-label]")
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
    expect(trigger()).toBeNull();
  });

  it("opens a tooltip only on a hover or a focus made while the words are hidden", async () => {
    render(
      <Toolbar aria-label="Message">
        <ToolbarButton>
          <Icon />
          <ToolbarLabel>Reply</ToolbarLabel>
        </ToolbarButton>
        <ToolbarButton>
          <Icon />
          <ToolbarLabel>Forward</ToolbarLabel>
        </ToolbarButton>
      </Toolbar>,
    );
    await settle();
    const tooltips = () =>
      [...document.querySelectorAll("[data-slot=tooltip-content]")].map(
        (tooltip) => tooltip.firstChild?.textContent,
      );
    // Each heard while its words show, then left.
    const reply = screen.getByRole("button", { name: "Reply" });
    fireEvent.pointerMove(reply, { pointerType: "mouse" });
    fireEvent.pointerLeave(reply, { pointerType: "mouse" });
    const forward = screen.getByRole("button", { name: "Forward" });
    act(() => forward.focus());
    act(() => forward.blur());
    await layout.resize(100);
    expect(reply.dataset.size).toBe("icon");
    expect(tooltips()).toEqual([]);
    fireEvent.pointerMove(reply, { pointerType: "mouse" });
    await settle();
    expect(tooltips()).toEqual(["Reply"]);
  });

  it("moves labelled commands whole on a coarse pointer", async () => {
    render(
      <div data-pointer="coarse">
        <Toolbar aria-label="Message">
          <ToolbarButton>
            <Icon />
            <ToolbarLabel>Reply</ToolbarLabel>
          </ToolbarButton>
          <ToolbarButton>
            <Icon />
            <ToolbarLabel>Forward</ToolbarLabel>
          </ToolbarButton>
        </Toolbar>
      </div>,
    );
    await settle();
    await layout.resize(110);
    expect(screen.getByRole("button", { name: "Reply" }).dataset.size).toBe(
      "default",
    );
    expect(overflowed("Forward")).toBe(true);
  });

  it("keeps a primary command's words", async () => {
    render(
      <Toolbar aria-label="Compose">
        <ToolbarButton>
          <Icon />
          <ToolbarLabel>Attach</ToolbarLabel>
        </ToolbarButton>
        <ToolbarButton variant="default" priority="pin">
          <Icon />
          <ToolbarLabel>Send</ToolbarLabel>
        </ToolbarButton>
      </Toolbar>,
    );
    await settle();
    await layout.resize(100);
    expect(screen.getByRole("button", { name: "Send" }).dataset.size).toBe(
      "default",
    );
    expect(screen.getByRole("button", { name: "Attach" }).dataset.size).toBe(
      "icon",
    );
  });

  it("moves the cluster before the spacer first, and puts the ⋯ at its end", async () => {
    render(
      <Toolbar aria-label="Thread">
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
        <ToolbarButton aria-label="Delete">
          <Icon />
        </ToolbarButton>
        <ToolbarButton aria-label="Unread">
          <Icon />
        </ToolbarButton>
        <ToolbarSpacer />
        <ToolbarButton aria-label="Star">
          <Icon />
        </ToolbarButton>
      </Toolbar>,
    );
    await settle();
    // 112 does not fit 85; without Unread and Delete, Archive, the ⋯ and Star do.
    await layout.resize(85);
    expect(overflowed("Archive")).toBe(false);
    expect(overflowed("Delete")).toBe(true);
    expect(overflowed("Star")).toBe(false);
    const more = trigger();
    expect(more?.nextElementSibling?.getAttribute("data-slot")).toBe(
      "toolbar-spacer",
    );
  });

  it("moves a group whole, and keeps its menu form in step with the bar", async () => {
    const onValueChange = vi.fn();
    function Align() {
      const [value, setValue] = useState("left");
      return (
        <Toolbar aria-label="Format">
          <ToolbarButton aria-label="Bold">
            <Icon />
          </ToolbarButton>
          <ToolbarGroup
            label="Alignment"
            selection="single"
            value={value}
            onValueChange={(next) => {
              onValueChange(next);
              setValue(next);
            }}
          >
            <ToolbarButton value="left" aria-label="Left">
              <Icon />
            </ToolbarButton>
            <ToolbarButton value="right" aria-label="Right">
              <Icon />
            </ToolbarButton>
          </ToolbarGroup>
        </Toolbar>
      );
    }
    render(<Align />);
    await settle();
    expect(
      screen.getByRole("radio", { name: "Left" }).getAttribute("aria-checked"),
    ).toBe("true");
    await layout.resize(70);
    const group = document.querySelector("[data-slot=toolbar-group]");
    expect(group?.hasAttribute("data-overflowed")).toBe(true);
    expect(overflowed("Bold")).toBe(false);
    await openMore();
    const right = screen.getByRole("menuitemradio", { name: "Right" });
    expect(
      screen
        .getByRole("menuitemradio", { name: "Left" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.click(right);
    await settle();
    expect(onValueChange).toHaveBeenCalledWith("right");
    expect(
      screen
        .getByRole("radio", { name: "Right", hidden: true })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("follows a pressed toggle into the menu as a check item, and a link as a link", async () => {
    const onStar = vi.fn();
    render(
      <Toolbar aria-label="Thread">
        <ToolbarButton aria-label="Back" asChild>
          <a href="/inbox">
            <Icon />
          </a>
        </ToolbarButton>
        <ToolbarButton aria-label="Star" aria-pressed onClick={onStar}>
          <Icon />
        </ToolbarButton>
      </Toolbar>,
    );
    await settle();
    await layout.resize(20);
    await openMore();
    const link = screen.getByRole("menuitem", { name: "Back" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/inbox");
    expect(link.hasAttribute("type")).toBe(false);
    const star = screen.getByRole("menuitemcheckbox", { name: "Star" });
    expect(star.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(star);
    expect(onStar).toHaveBeenCalled();
  });

  it("keeps a button that opens its own surface on the bar, and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <Toolbar aria-label="Thread">
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolbarButton aria-label="Labels">
              <Icon />
            </ToolbarButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>design</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Toolbar>,
    );
    await settle();
    await layout.resize(40);
    expect(overflowed("Labels")).toBe(false);
    expect(overflowed("Archive")).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("lists a ToolbarMenu as a submenu with its value", async () => {
    render(
      <Toolbar aria-label="Issues">
        <ToolbarMenu icon={<Icon />} label="Status" value="Open">
          <DropdownMenuItem>Closed</DropdownMenuItem>
        </ToolbarMenu>
      </Toolbar>,
    );
    await settle();
    expect(screen.getByRole("button", { name: "Status Open" })).toBeTruthy();
    await layout.resize(10);
    const items = await openMore();
    expect(items).toEqual(["StatusOpen"]);
    expect(
      screen
        .getByRole("menuitem", { name: "Status Open" })
        .getAttribute("aria-haspopup"),
    ).toBe("menu");
  });

  it("shows a permanent ToolbarOverflow always, below what overflowed, with one separator", async () => {
    render(
      <Toolbar aria-label="Thread">
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
        <ToolbarButton aria-label="Delete">
          <Icon />
        </ToolbarButton>
        <ToolbarOverflow>
          <DropdownMenuItem>Forward</DropdownMenuItem>
        </ToolbarOverflow>
      </Toolbar>,
    );
    await settle();
    expect(trigger()).not.toBeNull();
    expect(await openMore()).toEqual(["Forward"]);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await settle();
    await layout.resize(60);
    expect(await openMore()).toEqual(["Delete", "Forward"]);
    expect(
      document.querySelectorAll("[role=menu] [role=separator]"),
    ).toHaveLength(1);
  });

  it("leaves a part the caller's CSS undisplays out of the count and the menu", async () => {
    render(
      <Toolbar aria-label="Thread">
        <ToolbarButton aria-label="Back" style={{ display: "none" }}>
          <Icon />
        </ToolbarButton>
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
        <ToolbarButton aria-label="Delete">
          <Icon />
        </ToolbarButton>
        <ToolbarButton aria-label="Unread">
          <Icon />
        </ToolbarButton>
      </Toolbar>,
    );
    await settle();
    await layout.resize(84);
    expect(trigger()).toBeNull();
    await layout.resize(60);
    expect(await openMore()).toEqual(["Delete", "Unread"]);
  });

  it("hands the focus to the ⋯ when the part holding it goes into the menu", async () => {
    render(<Commands />);
    await settle();
    screen.getByRole("button", { name: "Snooze" }).focus();
    await layout.resize(90);
    expect(document.activeElement).toBe(trigger());
  });

  it("hides separators that would part nothing", async () => {
    render(
      <Toolbar aria-label="Format">
        <ToolbarButton aria-label="Bold">
          <Icon />
        </ToolbarButton>
        <ToolbarSeparator data-testid="separator" />
        <ToolbarButton aria-label="Link">
          <Icon />
        </ToolbarButton>
      </Toolbar>,
    );
    await settle();
    const separator = screen.getByTestId("separator");
    expect(separator.className).not.toContain("invisible");
    await layout.resize(60);
    expect(separator.className).toContain("invisible");
  });

  it("stays as tall as a part it holds for the ⋯ menu", async () => {
    render(
      <Toolbar aria-label="Editor">
        <ToolbarButton aria-label="Bold">
          <Icon />
        </ToolbarButton>
        <ToolbarItem
          overflow={<DropdownMenuItem>Zoom</DropdownMenuItem>}
          data-test-width="120"
          data-test-height="40"
        >
          Zoom
        </ToolbarItem>
      </Toolbar>,
    );
    await settle();
    expect(row()?.style.minHeight).toBe("40px");
    await layout.resize(80);
    expect(await openMore()).toEqual(["Zoom"]);
    expect(row()?.style.minHeight).toBe("40px");
    // Drawn taller (another style), it is followed on the next frame.
    const zoom = document.querySelector<HTMLElement>("[data-test-height]");
    if (zoom) zoom.dataset.testHeight = "44";
    await layout.resize(90);
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    expect(row()?.style.minHeight).toBe("44px");
  });

  it("tells a ToolbarItem where it stands, and draws its overflow form", async () => {
    const seen: string[] = [];
    function Probe() {
      const item = useToolbarItem();
      seen.push(`${item?.surface}:${item?.overflowed}`);
      return <span data-test-width="50">Saved</span>;
    }
    render(
      <Toolbar aria-label="Editor">
        <ToolbarItem overflow={<DropdownMenuItem>Saved</DropdownMenuItem>}>
          <Probe />
        </ToolbarItem>
      </Toolbar>,
    );
    await settle();
    expect(seen.at(-1)).toBe("bar:false");
    await layout.resize(30);
    expect(seen.at(-1)).toBe("bar:true");
    expect(await openMore()).toEqual(["Saved"]);
  });

  it("draws in full before it is measured, wrapping rather than cutting a part in half", () => {
    const html = renderToString(
      <Toolbar aria-label="Thread">
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
        <ToolbarOverflow>
          <DropdownMenuItem>Forward</DropdownMenuItem>
        </ToolbarOverflow>
      </Toolbar>,
    );
    expect(html).toContain("flex-wrap");
    expect(html).toContain("overflow-hidden");
    expect(html).not.toContain("data-overflowed");
    // A permanent ⋯ is drawn from the start; one that only holds overflow is not.
    expect(html).toContain("toolbar-overflow-trigger");
    const bare = renderToString(
      <Toolbar aria-label="Thread">
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
      </Toolbar>,
    );
    expect(bare).not.toContain("toolbar-overflow-trigger");
  });
});

describe("ToolbarSearch", () => {
  function Search({ initial = "" }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return (
      <Toolbar aria-label="Issues">
        <ToolbarSearch
          label="Search issues"
          value={value}
          onValueChange={setValue}
        />
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
        <ToolbarButton aria-label="Delete">
          <Icon />
        </ToolbarButton>
      </Toolbar>
    );
  }

  it("gives way to its icon while empty, and opens again on the same field", async () => {
    render(<Search />);
    await settle();
    const input = screen.getByRole("searchbox", { name: "Search issues" });
    // 160 + 56 = 216 does not fit 120; the icon (28) and both buttons do.
    await layout.resize(120);
    const icon = screen.getByRole("button", { name: "Search issues" });
    expect(overflowed("Archive")).toBe(false);
    fireEvent.click(icon);
    await settle();
    await settle();
    const again = screen.getByRole("searchbox", {
      name: "Search issues",
      hidden: true,
    });
    expect(again).toBe(input);
    expect(document.activeElement).toBe(input);
    // Open, it makes room by moving the buttons, and then takes the bar.
    expect(
      document
        .querySelector("[data-slot=toolbar]")
        ?.hasAttribute("data-search-takeover"),
    ).toBe(true);
  });

  it("keeps the bar as tall as its field while the icon stands in for it", async () => {
    render(<Search />);
    await settle();
    expect(row()?.style.minHeight).toBe("32px");
    await layout.resize(120);
    expect(
      document
        .querySelector("[data-slot=toolbar-search]")
        ?.hasAttribute("data-collapsed"),
    ).toBe(true);
    expect(row()?.style.minHeight).toBe("32px");
  });

  it("never turns into its icon with a query", async () => {
    render(<Search initial="bug" />);
    await settle();
    await layout.resize(200);
    expect(
      document
        .querySelector("[data-slot=toolbar-search]")
        ?.hasAttribute("data-collapsed"),
    ).toBe(false);
    expect(overflowed("Delete")).toBe(true);
  });

  it("opens onto a field of the caller's own, as a QueryBox is", async () => {
    render(
      <Toolbar aria-label="Mail">
        <ToolbarSearch label="Search mail" value="">
          <input aria-label="Query" />
        </ToolbarSearch>
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
      </Toolbar>,
    );
    await settle();
    await layout.resize(60);
    fireEvent.click(screen.getByRole("button", { name: "Search mail" }));
    await settle();
    await settle();
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Query", hidden: true }),
    );
  });

  it("keeps the arrow keys for the caret", async () => {
    const outer = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: listens for what escapes the field
      <div onKeyDown={outer}>
        <Search />
      </div>,
    );
    await settle();
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "ArrowLeft" });
    expect(outer).not.toHaveBeenCalled();
  });
});

describe("SegmentedControl in a Toolbar", () => {
  function Words({ value, children }: { value: string; children: string }) {
    return (
      <SegmentedControlItem value={value}>{children}</SegmentedControlItem>
    );
  }

  it("goes from segments to a dropdown of its value to radio items in the menu", async () => {
    render(
      <Toolbar aria-label="Layout">
        <SegmentedControl aria-label="View" defaultValue="board">
          <Words value="list">List</Words>
          <Words value="board">Board</Words>
          <Words value="calendar">Calendar</Words>
        </SegmentedControl>
      </Toolbar>,
    );
    await settle();
    const control = document.querySelector("[data-slot=segmented-control]");
    expect(control?.hasAttribute("data-collapsed")).toBe(false);
    // Segments: 28 + 35 + 56 = 119; the dropdown: 20 + 35 + 6 + 16 = 77.
    await layout.resize(90);
    expect(control?.hasAttribute("data-collapsed")).toBe(true);
    expect(screen.getByRole("button", { name: "View: Board" })).toBeTruthy();
    await layout.resize(40);
    await openMore();
    expect(
      screen
        .getAllByRole("menuitemradio")
        .map((item) => [item.textContent, item.getAttribute("aria-checked")]),
    ).toEqual([
      ["List", "false"],
      ["Board", "true"],
      ["Calendar", "false"],
    ]);
  });

  it("keeps the bar as tall as its segments while the dropdown stands in for them", async () => {
    render(
      <Toolbar aria-label="Layout">
        <SegmentedControl aria-label="View" defaultValue="board">
          <SegmentedControlItem value="list" data-test-height="30">
            List
          </SegmentedControlItem>
          <SegmentedControlItem value="board" data-test-height="30">
            Board
          </SegmentedControlItem>
          <SegmentedControlItem value="calendar" data-test-height="30">
            Calendar
          </SegmentedControlItem>
        </SegmentedControl>
      </Toolbar>,
    );
    await settle();
    expect(row()?.style.minHeight).toBe("30px");
    await layout.resize(90);
    expect(
      document
        .querySelector("[data-slot=segmented-control]")
        ?.hasAttribute("data-collapsed"),
    ).toBe(true);
    expect(row()?.style.minHeight).toBe("30px");
  });
});

describe("FilterMenu in a Toolbar", () => {
  function Filters() {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("open");
    return (
      <Toolbar aria-label="Issues">
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
        <FilterMenu
          query={query}
          onQueryChange={setQuery}
          sections={[
            {
              id: "all",
              rows: [
                { id: "open", label: "Open" },
                { id: "closed", label: "Closed" },
              ],
            },
          ]}
          renderRow={(row) => row.label}
          selectedId={status}
          onSelect={(row) => setStatus(row.id)}
          listLabel="Status"
          toolbarValue={status === "open" ? "Open" : "Closed"}
          toolbarActive={status !== "open"}
        >
          <button type="button" data-test-width="90">
            Status
          </button>
        </FilterMenu>
      </Toolbar>
    );
  }

  it("opens from its row in the ⋯ menu, and hands the focus back to the ⋯", async () => {
    render(<Filters />);
    await settle();
    await layout.resize(60);
    expect(await openMore()).toEqual(["StatusOpen"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Status Open" }));
    await settle();
    await settle();
    const box = screen.getByRole("combobox", { name: "Filter" });
    expect(document.activeElement).toBe(box);
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    await settle();
    await settle();
    expect(document.activeElement).toBe(trigger());
    expect(trigger()?.getAttribute("aria-label")).toBe(
      "More actions (1 active)",
    );
  });
});

describe("FilterMenu with a ToolbarButton for its trigger", () => {
  it("is one stop for the arrow keys", async () => {
    render(
      <Toolbar aria-label="Issues">
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
        <FilterMenu
          query=""
          onQueryChange={() => {}}
          sections={[{ id: "all", rows: [{ id: "open" }] }]}
          renderRow={(row) => row.id}
          onSelect={() => {}}
          listLabel="Status"
        >
          <ToolbarButton>Status</ToolbarButton>
        </FilterMenu>
        <ToolbarButton aria-label="Delete">
          <Icon />
        </ToolbarButton>
      </Toolbar>,
    );
    await settle();
    const arrow = async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "ArrowRight",
      });
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      return (
        document.activeElement?.textContent ||
        document.activeElement?.getAttribute("aria-label")
      );
    };
    screen.getByRole("button", { name: "Archive" }).focus();
    expect(await arrow()).toBe("Status");
    expect(await arrow()).toBe("Delete");
  });
});

describe("SplitButton in a Toolbar", () => {
  it("is flat, hides its command's words, and goes to the menu as an item and a submenu", async () => {
    const onMerge = vi.fn();
    render(
      <Toolbar aria-label="Pull request">
        <SplitButton>
          <SplitButtonAction onClick={onMerge}>
            <Icon />
            <ToolbarLabel>Merge</ToolbarLabel>
          </SplitButtonAction>
          <SplitButtonMenu triggerLabel="Merge options">
            <DropdownMenuItem>Squash and merge</DropdownMenuItem>
          </SplitButtonMenu>
        </SplitButton>
      </Toolbar>,
    );
    await settle();
    const action = screen.getByRole("button", { name: "Merge" });
    expect(action.dataset.variant).toBe("ghost");
    // 20 + 16 + 6 + 35 = 77, and the arrow 28: hiding the words leaves 56.
    await layout.resize(80);
    expect(action.dataset.size).toBe("icon");
    await layout.resize(20);
    expect(await openMore()).toEqual(["Merge", "Merge options"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Merge" }));
    expect(onMerge).toHaveBeenCalled();
  });
});
