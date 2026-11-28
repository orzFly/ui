import { act, fireEvent, render, screen } from "@testing-library/react";
import { useContext, useState } from "react";
import { renderToString } from "react-dom/server";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../src/components/dropdown-menu.tsx";
import { FilterMenu } from "../src/components/filter-menu.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../src/components/popover.tsx";
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
  ToolbarInternalContext,
  type ToolbarStore,
} from "../src/components/toolbar/store.ts";
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

/** What Tab stops on in the bar, in order, by name. */
const tabStops = (bar: HTMLElement) =>
  [bar, ...bar.querySelectorAll<HTMLElement>("*")]
    .filter(
      (el) =>
        el.tabIndex >= 0 &&
        !el.closest("[inert]") &&
        !el.matches(":disabled") &&
        getComputedStyle(el).display !== "none",
    )
    .map((el) => el.getAttribute("aria-label") ?? el.textContent);

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

  it("holds one Tab stop for its commands: the first, then the one last focused", async () => {
    render(<Commands />);
    await settle();
    const bar = screen.getByRole("toolbar", { name: "Commands" });
    expect(tabStops(bar)).toEqual(["Archive"]);
    act(() => screen.getByRole("button", { name: "Unread" }).focus());
    await settle();
    expect(tabStops(bar)).toEqual(["Unread"]);
  });

  it("gives the stop to the first command while the last one focused is in the ⋯ menu", async () => {
    render(<Commands />);
    await settle();
    const bar = screen.getByRole("toolbar", { name: "Commands" });
    act(() => screen.getByRole("button", { name: "Snooze" }).focus());
    act(() => (document.activeElement as HTMLElement).blur());
    await layout.resize(90);
    expect(tabStops(bar)).toEqual(["Archive"]);
    await layout.resize(1000);
    expect(tabStops(bar)).toEqual(["Snooze"]);
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
    // Cut off at a control's height, or at what the bar sets instead.
    expect(html).toContain(
      "max-h-[var(--toolbar-row-cap,var(--spacing-control))]",
    );
    expect(html).toContain(
      "touch:max-h-[var(--toolbar-row-cap,var(--spacing-field-touch))]",
    );
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

  it("is a Tab stop where it stands, before the commands' one", async () => {
    render(<Search />);
    await settle();
    const bar = screen.getByRole("toolbar", { name: "Issues" });
    expect(tabStops(bar)).toEqual(["Search issues", "Archive"]);
    act(() => screen.getByRole("button", { name: "Delete" }).focus());
    act(() => screen.getByRole("searchbox").focus());
    await settle();
    expect(tabStops(bar)).toEqual(["Search issues", "Delete"]);
  });

  it("gives the commands' stop to its button back while it holds the bar", async () => {
    render(<Search />);
    await settle();
    const bar = screen.getByRole("toolbar", { name: "Issues" });
    await layout.resize(120);
    fireEvent.click(screen.getByRole("button", { name: "Search issues" }));
    await settle();
    await settle();
    expect(tabStops(bar)).toEqual(["Back", "Search issues"]);
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

  it("opens from the ⋯ menu on the list, without a fine pointer", async () => {
    render(
      <div data-pointer="coarse">
        <Filters />
      </div>,
    );
    await settle();
    await layout.resize(60);
    expect(await openMore()).toEqual(["StatusOpen"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Status Open" }));
    await settle();
    await settle();
    expect(document.activeElement).toBe(
      screen.getByRole("listbox", { name: "Status" }),
    );
  });
});

describe("FilterMenu held where it stands in a Toolbar while open", () => {
  const LABELS = ["bug", "docs", "ui"].map((id) => ({ id }));

  /** A multiple-selection filter whose trigger is as wide as the test says. */
  function Labels({ width }: { width: number }) {
    const [query, setQuery] = useState("");
    const [picked, setPicked] = useState<string[]>([]);
    return (
      <Toolbar aria-label="Issues">
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
        <FilterMenu
          selection="multiple"
          selectedIds={picked}
          query={query}
          onQueryChange={setQuery}
          sections={[{ id: "all", rows: LABELS }]}
          renderRow={(row) => row.id}
          onSelect={(row, event) =>
            setPicked((ids) =>
              event.selected
                ? [...ids, row.id]
                : ids.filter((id) => id !== row.id),
            )
          }
          listLabel="Labels"
          toolbarActive={picked.length > 0}
        >
          <button type="button" data-test-width={width}>
            Labels
          </button>
        </FilterMenu>
        <ToolbarButton aria-label="Delete">
          <Icon />
        </ToolbarButton>
      </Toolbar>
    );
  }

  const labels = () =>
    screen.getByRole("button", { name: "Labels", hidden: true });
  const inMore = (name: string) =>
    screen
      .getByRole("button", { name, hidden: true })
      .closest("[data-overflowed]") !== null;

  /** Opens Labels from its row in the ⋯ menu. */
  async function openFromMore() {
    expect(await openMore()).toContain("Labels");
    fireEvent.click(screen.getByRole("menuitem", { name: "Labels" }));
    await settle();
    await settle();
    return screen.getByRole("combobox", { name: "Filter" });
  }

  it("stays in the ⋯ while picks change its width and set it away, and hands the focus back to the ⋯", async () => {
    const { rerender } = render(<Labels width={90} />);
    await settle();
    // Archive and the ⋯ fit in 100; Labels does not beside them.
    await layout.resize(100);
    expect(inMore("Labels")).toBe(true);
    const box = await openFromMore();
    fireEvent.click(screen.getByRole("option", { name: "bug" }));
    fireEvent.click(screen.getByRole("option", { name: "ui" }));
    await settle();
    expect(screen.getByRole("listbox", { name: "Labels" })).toBeTruthy();
    expect(
      screen
        .getAllByRole("option")
        .map((el) => el.getAttribute("aria-checked")),
    ).toEqual(["true", "false", "true"]);
    // Narrow enough to stand on the bar, and set away from its default.
    rerender(<Labels width={30} />);
    await layout.resize(100);
    expect(inMore("Labels")).toBe(true);
    expect(trigger()).toBeTruthy();
    expect(trigger()?.getAttribute("aria-label")).toBe(
      "More actions (1 active)",
    );
    rerender(<Labels width={90} />);
    await layout.resize(100);
    fireEvent.keyDown(box, { key: "Escape" });
    await settle();
    await settle();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(inMore("Labels")).toBe(true);
    expect(document.activeElement).toBe(trigger());
  });

  it("goes back to the bar once closed if it fits there, the focus on its trigger once the ⋯ has gone", async () => {
    const { rerender } = render(<Labels width={90} />);
    await settle();
    await layout.resize(100);
    const box = await openFromMore();
    fireEvent.click(screen.getByRole("option", { name: "docs" }));
    rerender(<Labels width={30} />);
    await layout.resize(100);
    expect(inMore("Labels")).toBe(true);
    fireEvent.keyDown(box, { key: "Escape" });
    await settle();
    await settle();
    expect(inMore("Labels")).toBe(false);
    expect(trigger()).toBeNull();
    expect(document.activeElement).toBe(labels());
  });

  it("stays on the bar while open, the others going to the ⋯, and is laid out as ever once closed", async () => {
    const { rerender, unmount } = render(<Labels width={90} />);
    await settle();
    await layout.resize(200);
    expect(trigger()).toBeNull();
    fireEvent.click(labels());
    await settle();
    expect(screen.getByRole("listbox", { name: "Labels" })).toBeTruthy();
    // Too wide for all three: Delete goes, then Labels would, but Archive does.
    rerender(<Labels width={160} />);
    await layout.resize(200);
    expect(inMore("Labels")).toBe(false);
    expect(inMore("Archive")).toBe(true);
    expect(inMore("Delete")).toBe(true);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    await settle();
    await settle();
    const closed = ["Archive", "Labels", "Delete"].map(inMore);
    expect(closed).toEqual([false, true, true]);
    expect(document.activeElement).toBe(trigger());

    unmount();
    render(<Labels width={160} />);
    await settle();
    await layout.resize(200);
    expect(["Archive", "Labels", "Delete"].map(inMore)).toEqual(closed);
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

  function Labelled() {
    const [query, setQuery] = useState("");
    const [picked, setPicked] = useState<string[]>([]);
    return (
      <Toolbar aria-label="Issues">
        <ToolbarButton>
          <Icon />
          <ToolbarLabel>Reply</ToolbarLabel>
        </ToolbarButton>
        <FilterMenu
          selection="multiple"
          selectedIds={picked}
          query={query}
          onQueryChange={setQuery}
          sections={[{ id: "all", rows: [{ id: "bug" }, { id: "docs" }] }]}
          renderRow={(row) => row.id}
          onSelect={(row, event) =>
            setPicked((ids) =>
              event.selected
                ? [...ids, row.id]
                : ids.filter((id) => id !== row.id),
            )
          }
          listLabel="Labels"
        >
          <ToolbarButton>
            <Icon />
            <ToolbarLabel>Labels</ToolbarLabel>
          </ToolbarButton>
        </FilterMenu>
      </Toolbar>
    );
  }

  const button = (name: string) =>
    screen.getByRole("button", { name, hidden: true });
  const wordsHidden = (name: string) =>
    button(name)
      .querySelector("[data-slot=toolbar-label]")
      ?.getAttribute("aria-hidden") === "true";

  it("hides the trigger's words with the other commands' on a fine pointer", async () => {
    render(<Labelled />);
    await settle();
    // Full: 77 and 84; with the words hidden, 28 each.
    await layout.resize(100);
    expect(wordsHidden("Labels")).toBe(true);
    expect(wordsHidden("Reply")).toBe(true);
    expect(button("Labels").getAttribute("aria-label")).toBe("Labels");
    expect(button("Labels").dataset.size).toBe("icon");
    expect(button("Labels").closest("[data-overflowed]")).toBeNull();
    expect(trigger()).toBeNull();
    fireEvent.pointerMove(button("Labels"), { pointerType: "mouse" });
    // The provider opens its first tooltip a task later, delayed by 0.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(
      [...document.querySelectorAll("[data-slot=tooltip-content]")].map(
        (tooltip) => tooltip.firstChild?.textContent,
      ),
    ).toEqual(["Labels"]);
  });

  it("moves the trigger whole on a coarse pointer", async () => {
    render(
      <div data-pointer="coarse">
        <Labelled />
      </div>,
    );
    await settle();
    // Reply and the ⋯ fit in 120; Labels does not beside them.
    await layout.resize(120);
    expect(wordsHidden("Labels")).toBe(false);
    expect(button("Labels").closest("[data-overflowed]")).not.toBeNull();
  });

  it("keeps the trigger's words while it is open", async () => {
    render(<Labelled />);
    await settle();
    fireEvent.click(button("Labels"));
    await settle();
    expect(screen.getByRole("listbox", { name: "Labels" })).toBeTruthy();
    // Open, Labels takes no step: Reply's words go, and Labels' stay.
    await layout.resize(130);
    expect(wordsHidden("Reply")).toBe(true);
    expect(wordsHidden("Labels")).toBe(false);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    await settle();
    await settle();
    expect(wordsHidden("Labels")).toBe(true);
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

describe("Toolbar as it lays itself out again", () => {
  /** Frames the test runs by hand, so it can look between them. */
  function stubFrames() {
    const frames = new Map<number, FrameRequestCallback>();
    let next = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.set(++next, callback);
      return next;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    return {
      frames,
      run() {
        const due = [...frames.values()];
        frames.clear();
        for (const callback of due) callback(0);
      },
    };
  }

  it("lets nothing in the row transition in the frame a new layout is first drawn in", async () => {
    const clock = stubFrames();
    const { unmount } = render(<Commands />);
    await settle();
    clock.run();
    expect(row()?.hasAttribute("data-relayout")).toBe(false);
    await layout.resize(90);
    expect(overflowed("Snooze")).toBe(true);
    expect(row()?.hasAttribute("data-relayout")).toBe(true);
    clock.run();
    expect(row()?.hasAttribute("data-relayout")).toBe(false);
    // The same layout again is no new one.
    await layout.resize(90);
    expect(row()?.hasAttribute("data-relayout")).toBe(false);
    expect(clock.frames.size).toBe(0);
    await layout.resize(1000);
    const el = row();
    expect(el?.hasAttribute("data-relayout")).toBe(true);
    unmount();
    expect(el?.hasAttribute("data-relayout")).toBe(false);
    expect(clock.frames.size).toBe(0);
  });

  it("draws nothing it holds for the ⋯ menu with a transition", async () => {
    render(<Commands />);
    await settle();
    await layout.resize(90);
    const snooze = screen.getByRole("button", { name: "Snooze", hidden: true });
    expect(snooze.className).toContain("transition-none");
    expect(snooze.className).not.toContain("transition-all");
  });
});

describe("Toolbar parts set away from their defaults", () => {
  const count = () =>
    trigger()?.querySelector<HTMLElement>("[data-slot=toolbar-overflow-count]");

  function Format({ active }: { active?: boolean }) {
    return (
      <Toolbar aria-label="Format">
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
        <ToolbarButton aria-label="Delete">
          <Icon />
        </ToolbarButton>
        <ToolbarButton aria-label="Bold" aria-pressed active={active}>
          <Icon />
        </ToolbarButton>
      </Toolbar>
    );
  }

  it("counts a pressed ToolbarButton as set away, unless told otherwise", async () => {
    const { unmount } = render(<Format />);
    await settle();
    await layout.resize(60);
    expect(overflowed("Bold")).toBe(false);
    expect(overflowed("Archive")).toBe(true);
    unmount();
    await layout.resize(1000);
    render(<Format active={false} />);
    await settle();
    await layout.resize(60);
    expect(overflowed("Bold")).toBe(true);
    expect(overflowed("Archive")).toBe(false);
    expect(count()).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Bold", hidden: true })
        .hasAttribute("active"),
    ).toBe(false);
  });

  it("counts a single-choice ToolbarGroup given active, and marks its heading in the menu", async () => {
    render(
      <Toolbar aria-label="Layout">
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
        <ToolbarGroup
          label="Alignment"
          selection="single"
          defaultValue="right"
          active
        >
          <ToolbarButton value="left" aria-label="Left">
            <Icon />
          </ToolbarButton>
          <ToolbarButton value="right" aria-label="Right">
            <Icon />
          </ToolbarButton>
        </ToolbarGroup>
        <ToolbarButton aria-label="Delete">
          <Icon />
        </ToolbarButton>
      </Toolbar>,
    );
    await settle();
    const group = document.querySelector("[data-slot=toolbar-group]");
    // 28 + 56 + 28 = 112: Delete and Archive go before the group.
    await layout.resize(100);
    expect(group?.hasAttribute("data-overflowed")).toBe(false);
    expect(group?.hasAttribute("active")).toBe(false);
    // All three: the ⋯ with its count, 28 + 3 + 16.
    await layout.resize(50);
    expect(group?.hasAttribute("data-overflowed")).toBe(true);
    expect(count()?.textContent).toBe("1");
    await openMore();
    expect(
      screen
        .getByText("Alignment")
        .querySelector("[data-slot=toolbar-active-mark]"),
    ).not.toBeNull();
  });

  it("counts a SegmentedControl given toolbarActive", async () => {
    render(
      <Toolbar aria-label="Layout">
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
        <SegmentedControl
          aria-label="View"
          defaultValue="board"
          collapse="overflow"
          toolbarActive
        >
          <SegmentedControlItem value="list">List</SegmentedControlItem>
          <SegmentedControlItem value="board">Board</SegmentedControlItem>
        </SegmentedControl>
        <ToolbarButton aria-label="Delete">
          <Icon />
        </ToolbarButton>
      </Toolbar>,
    );
    await settle();
    const control = document.querySelector("[data-slot=segmented-control]");
    // 28 + 63 + 28 = 119: Delete and Archive go first.
    await layout.resize(100);
    expect(control?.hasAttribute("data-overflowed")).toBe(false);
    expect(trigger()?.getAttribute("aria-label")).toBe("More actions");
    await layout.resize(50);
    expect(control?.hasAttribute("data-overflowed")).toBe(true);
    expect(trigger()?.getAttribute("aria-label")).toBe(
      "More actions (1 active)",
    );
    await openMore();
    expect(
      screen.getByText("View").querySelector("[data-slot=toolbar-active-mark]"),
    ).not.toBeNull();
  });

  function Menus({ active }: { active: boolean[] }) {
    return (
      <Toolbar aria-label="Issues">
        {active.map((on, i) => (
          <ToolbarMenu
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list
            key={i}
            icon={<Icon />}
            label={`F${i}`}
            active={on}
          >
            <DropdownMenuItem>Any</DropdownMenuItem>
          </ToolbarMenu>
        ))}
      </Toolbar>
    );
  }

  it("counts on the ⋯ the parts in it set away, in a marker badge hidden from a screen reader", async () => {
    render(<Menus active={[true, false, true]} />);
    await settle();
    await layout.resize(60);
    const badge = count();
    expect(badge?.textContent).toBe("2");
    expect(badge?.getAttribute("aria-hidden")).toBe("true");
    expect(badge?.dataset.variant).toBe("marker");
    expect(trigger()?.getAttribute("aria-label")).toBe(
      "More actions (2 active)",
    );
  });

  it("counts ten or more as 9+", async () => {
    render(<Menus active={Array.from({ length: 10 }, () => true)} />);
    await settle();
    // The ⋯ with `9+`: 28 + 3 + 22.
    await layout.resize(60);
    expect(count()?.textContent).toBe("9+");
    expect(trigger()?.getAttribute("aria-label")).toBe(
      "More actions (10 active)",
    );
  });

  it("counts nothing while only parts at their defaults are in the ⋯", async () => {
    render(<Menus active={[false, false]} />);
    await settle();
    await layout.resize(30);
    expect(trigger()).not.toBeNull();
    expect(count()).toBeNull();
    expect(trigger()?.getAttribute("aria-label")).toBe("More actions");
  });

  it("lays a permanent ⋯ out once with its count, not again for it", async () => {
    render(
      <Toolbar aria-label="Thread">
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
        <ToolbarButton aria-label="Star" aria-pressed priority={-1}>
          <Icon />
        </ToolbarButton>
        <ToolbarOverflow>
          <DropdownMenuItem>Forward</DropdownMenuItem>
        </ToolbarOverflow>
      </Toolbar>,
    );
    await settle();
    // Star in the ⋯: 28 and the ⋯ with its count, 47.
    await layout.resize(76);
    expect(overflowed("Star")).toBe(true);
    expect(overflowed("Archive")).toBe(false);
    expect(count()?.textContent).toBe("1");
    // Measured in place with its count, which is not added twice.
    await layout.resize(76);
    await layout.resize(76);
    expect(overflowed("Archive")).toBe(false);
    expect(count()?.textContent).toBe("1");
  });

  it("marks the rows in the ⋯ menu of the parts set away, and leaves the others quiet", async () => {
    render(
      <Toolbar aria-label="Issues">
        <ToolbarMenu icon={<Icon />} label="Status" value="Closed" active>
          <DropdownMenuItem>Open</DropdownMenuItem>
        </ToolbarMenu>
        <ToolbarMenu icon={<Icon />} label="Owner" value="Anyone">
          <DropdownMenuItem>Me</DropdownMenuItem>
        </ToolbarMenu>
        <ToolbarMenu icon={<Icon />} label="Labels" active>
          <DropdownMenuItem>design</DropdownMenuItem>
        </ToolbarMenu>
        <FilterMenu
          query=""
          onQueryChange={() => {}}
          sections={[{ id: "all", rows: [{ id: "alice" }] }]}
          renderRow={(r) => r.id}
          onSelect={() => {}}
          listLabel="Author"
          toolbarValue="Alice"
          toolbarActive
        >
          <button type="button" data-test-width="90">
            Author
          </button>
        </FilterMenu>
      </Toolbar>,
    );
    await settle();
    await layout.resize(60);
    await openMore();
    const mark = (name: string) =>
      screen
        .getByRole("menuitem", { name })
        .querySelector("[data-slot=toolbar-active-mark]");
    expect(mark("Status Closed")).not.toBeNull();
    expect(mark("Owner Anyone")).toBeNull();
    expect(mark("Labels")).not.toBeNull();
    expect(mark("Author Alice")).not.toBeNull();
    const quiet = (name: string) =>
      screen
        .getByRole("menuitem", { name })
        .querySelector(".text-muted-foreground")?.textContent;
    expect(quiet("Status Closed")).toBeUndefined();
    expect(quiet("Owner Anyone")).toBe("Anyone");
  });
});

describe("Toolbar warnings", () => {
  let warn: MockInstance<typeof console.warn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());
  const warned = (text: string) =>
    warn.mock.calls.some(([message]) => String(message).includes(text));
  const NESTED = "another toolbar's row";
  const SIZED = "the width the browser gave it";

  it("warns of a toolbar in another's row", async () => {
    render(
      <Toolbar aria-label="Outer">
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
        <Toolbar aria-label="Inner">
          <ToolbarButton aria-label="Bold">
            <Icon />
          </ToolbarButton>
        </Toolbar>
      </Toolbar>,
    );
    await settle();
    expect(warned(NESTED)).toBe(true);
  });

  it("lets a toolbar stand in a surface a part opens", async () => {
    render(
      <Toolbar aria-label="Outer">
        <ToolbarItem>
          <Popover defaultOpen>
            <PopoverTrigger asChild>
              <button type="button">Format</button>
            </PopoverTrigger>
            <PopoverContent>
              <Toolbar aria-label="Inner">
                <ToolbarButton aria-label="Bold">
                  <Icon />
                </ToolbarButton>
              </Toolbar>
            </PopoverContent>
          </Popover>
        </ToolbarItem>
      </Toolbar>,
    );
    await settle();
    expect(screen.getByRole("toolbar", { name: "Inner" })).toBeTruthy();
    expect(warned(NESTED)).toBe(false);
  });

  it.each([
    ["grows", { flexGrow: 1 }],
    ["may shrink below its content", { minWidth: 0 }],
    ["clips what it shrinks over", { overflowX: "hidden" }],
  ] as const)("warns of a child it does not know that %s", async (_, style) => {
    render(
      <Toolbar aria-label="Inbox">
        <span style={style}>Inbox</span>
        <ToolbarButton aria-label="Refresh">
          <Icon />
        </ToolbarButton>
      </Toolbar>,
    );
    await settle();
    expect(warned(SIZED)).toBe(true);
    expect(
      warn.mock.calls.filter(([m]) => String(m).includes(SIZED)),
    ).toHaveLength(1);
  });

  it("counts plain text, a child that keeps its width, a spacer and a flex ToolbarItem without a word", async () => {
    render(
      <Toolbar aria-label="Inbox">
        <span>Inbox</span>
        <span style={{ flexShrink: 0, minWidth: 0 }}>12</span>
        <ToolbarSpacer />
        <ToolbarItem flex minWidth={80}>
          <span className="truncate">Search results</span>
        </ToolbarItem>
        <ToolbarButton aria-label="Refresh">
          <Icon />
        </ToolbarButton>
      </Toolbar>,
    );
    await settle();
    await layout.resize(100);
    expect(warned(SIZED)).toBe(false);
  });
});

describe("Toolbar remembering where the focus was", () => {
  let store: ToolbarStore | null = null;
  /** Reads the bar's store, drawing nothing. */
  function Probe() {
    store = useContext(ToolbarInternalContext)?.store ?? null;
    return null;
  }
  const last = () => store?.lastFocused ?? null;
  const tick = () =>
    act(() => new Promise((resolve) => setTimeout(resolve, 0)));

  function Bar({
    snooze = true,
    onSnooze,
  }: {
    snooze?: boolean;
    onSnooze?: () => void;
  }) {
    return (
      <>
        <Toolbar aria-label="Thread">
          <Probe />
          <ToolbarButton aria-label="Archive">
            <Icon />
          </ToolbarButton>
          <ToolbarMenu icon={<Icon />} label="Status">
            <DropdownMenuItem>Open</DropdownMenuItem>
          </ToolbarMenu>
          {snooze && (
            <ToolbarButton aria-label="Snooze" onClick={onSnooze}>
              <Icon />
            </ToolbarButton>
          )}
        </Toolbar>
        <button type="button">Outside</button>
      </>
    );
  }

  it("follows the focus in the bar, and forgets it once the focus leaves for another element", async () => {
    render(<Bar />);
    await settle();
    const archive = screen.getByRole("button", { name: "Archive" });
    archive.focus();
    expect(last()).toBe(archive);
    screen.getByRole("button", { name: "Outside" }).focus();
    expect(last()).toBeNull();
  });

  it("counts a part's own menu, though it is elsewhere in the document", async () => {
    render(<Bar />);
    await settle();
    fireEvent.keyDown(screen.getByRole("button", { name: "Status" }), {
      key: "Enter",
    });
    await settle();
    const menu = screen.getByRole("menu");
    expect(menu.closest("[data-slot=toolbar]")).toBeNull();
    const active = document.activeElement;
    expect(active !== null && menu.contains(active)).toBe(true);
    expect(last()).toBe(active);
  });

  it("counts the ⋯ menu", async () => {
    render(<Bar />);
    await settle();
    await layout.resize(60);
    expect(await openMore()).toContain("Snooze");
    const snooze = screen.getByRole("menuitem", { name: "Snooze" });
    snooze.focus();
    expect(last()).toBe(snooze);
  });

  it("keeps the element that held the focus as it is removed", async () => {
    const { rerender } = render(<Bar />);
    await settle();
    const snooze = screen.getByRole("button", { name: "Snooze" });
    snooze.focus();
    rerender(<Bar snooze={false} />);
    await settle();
    expect(snooze.isConnected).toBe(false);
    expect(last()).toBe(snooze);
  });

  it("forgets an element that lets go of the focus while still there", async () => {
    render(<Bar />);
    await settle();
    const archive = screen.getByRole("button", { name: "Archive" });
    archive.focus();
    archive.blur();
    expect(last()).toBe(archive);
    await settle();
    expect(last()).toBeNull();
  });

  it("gives the caller's ref the bar, and calls the caller's focus handlers too", async () => {
    const ref = { current: null as HTMLDivElement | null };
    const onFocus = vi.fn();
    render(
      <Toolbar aria-label="Thread" ref={ref} onFocus={onFocus}>
        <Probe />
        <ToolbarButton aria-label="Archive">
          <Icon />
        </ToolbarButton>
      </Toolbar>,
    );
    await settle();
    const bar = screen.getByRole("toolbar", { name: "Thread" });
    expect(ref.current).toBe(bar);
    // The store measures through the same element.
    expect(store?.pane).toBe(bar);
    const archive = screen.getByRole("button", { name: "Archive" });
    archive.focus();
    expect(onFocus).toHaveBeenCalled();
    expect(last()).toBe(archive);
  });

  it("leaves the focus where it was put once the ⋯ menu has closed, and takes it back otherwise", async () => {
    let outside: HTMLElement | null = null;
    render(<Bar onSnooze={() => setTimeout(() => outside?.focus(), 0)} />);
    await settle();
    outside = screen.getByRole("button", { name: "Outside" });
    await layout.resize(60);
    await openMore();
    fireEvent.click(screen.getByRole("menuitem", { name: "Snooze" }));
    await tick();
    await tick();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(outside);

    await openMore();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await tick();
    await tick();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });
});
