import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { useState } from "react";
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
import { isPlainClick } from "../src/lib/link.ts";

function Menu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Rename</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// A scroll starts with a finger landing on whatever is under it, and the
// browser only follows with a click when the finger lifted without moving.
describe("DropdownMenuTrigger on touch", () => {
  it("waits for the tap's click before opening", async () => {
    const view = render(<Menu />);
    const trigger = view.getByRole("button", { name: "Actions" });
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "touch" });
    await act(async () => {});
    expect(view.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    await view.findByRole("menuitem", { name: "Rename" });
  });

  it("stays shut when the touch became a scroll and no click came", async () => {
    const view = render(<Menu />);
    const trigger = view.getByRole("button", { name: "Actions" });
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "pen" });
    await act(async () => {});
    expect(view.queryByRole("menu")).toBeNull();
  });

  it("closes again on a second tap", async () => {
    const view = render(<Menu />);
    const trigger = view.getByRole("button", { name: "Actions" });
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "touch" });
    fireEvent.click(trigger);
    await view.findByRole("menu");
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "touch" });
    fireEvent.click(trigger);
    await waitFor(() => expect(view.queryByRole("menu")).toBeNull());
  });

  it("still opens on a mouse's pointerdown", async () => {
    const view = render(<Menu />);
    const trigger = view.getByRole("button", { name: "Actions" });
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
    await view.findByRole("menu");
  });

  it("reports a tap's open to a controlled menu", async () => {
    const seen: boolean[] = [];
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <DropdownMenu
          open={open}
          onOpenChange={(next) => {
            seen.push(next);
            setOpen(next);
          }}
        >
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Rename</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    const view = render(<Controlled />);
    const trigger = view.getByRole("button", { name: "Actions" });
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "touch" });
    fireEvent.click(trigger);
    await view.findByRole("menu");
    expect(seen).toEqual([true]);
  });
});

describe("DropdownMenuCheckboxItem", () => {
  it("draws a minus, not a check, for a mixed item", async () => {
    const view = render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Labels</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked="indeterminate">
            bug
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked>docs</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const mixed = await view.findByRole("menuitemcheckbox", { name: "bug" });
    const set = view.getByRole("menuitemcheckbox", { name: "docs" });
    expect(mixed.querySelector(".lucide-minus")).not.toBeNull();
    expect(mixed.querySelector(".lucide-check")).toBeNull();
    expect(set.querySelector(".lucide-check")).not.toBeNull();
  });
});

describe("DropdownMenuItem as a link", () => {
  function LinkMenu({
    onSelect,
    inPlace = false,
    target,
  }: {
    onSelect?: () => void;
    inPlace?: boolean;
    target?: string;
  }) {
    return (
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Sections</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild onSelect={onSelect}>
            <a
              href="/board"
              target={target}
              onClick={(event) => {
                // As a link that goes in place does, past isPlainClick.
                if (inPlace && isPlainClick(event)) event.preventDefault();
              }}
            >
              Board
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onSelect}>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Whether the page took the last click over, read once every handler in
  // it has run; then the click is stopped short of happy-dom's navigation.
  let tookOver: boolean | undefined;
  const stop = (event: MouseEvent) => {
    tookOver = event.defaultPrevented;
    event.preventDefault();
  };
  beforeEach(() => {
    tookOver = undefined;
    window.addEventListener("click", stop);
  });
  afterEach(() => window.removeEventListener("click", stop));

  const closed = (view: ReturnType<typeof render>) =>
    waitFor(() => expect(view.queryByRole("menu")).toBeNull());

  it("closes the menu on a plain click", async () => {
    const view = render(<LinkMenu />);
    fireEvent.click(await view.findByRole("menuitem", { name: "Board" }));
    await closed(view);
  });

  it("closes the menu on a plain click the link went in place for", async () => {
    const view = render(<LinkMenu inPlace />);
    fireEvent.click(await view.findByRole("menuitem", { name: "Board" }));
    expect(tookOver).toBe(true);
    await closed(view);
  });

  it("closes the menu on a plain click on a link that opens elsewhere", async () => {
    const view = render(<LinkMenu target="_blank" />);
    fireEvent.click(await view.findByRole("menuitem", { name: "Board" }));
    await closed(view);
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["⌘", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["Alt", { altKey: true }],
  ])(
    "leaves the menu open on a click with %s, to the browser",
    async (_, keys) => {
      const onSelect = vi.fn();
      const view = render(<LinkMenu onSelect={onSelect} inPlace />);
      fireEvent.click(
        await view.findByRole("menuitem", { name: "Board" }),
        keys,
      );
      // The link left it to the browser.
      expect(tookOver).toBe(false);
      await act(async () => {});
      expect(view.getByRole("menu")).toBeTruthy();
      expect(onSelect).toHaveBeenCalledTimes(1);
    },
  );

  it("closes the menu on Enter", async () => {
    const view = render(<LinkMenu inPlace />);
    const link = await view.findByRole("menuitem", { name: "Board" });
    act(() => link.focus());
    fireEvent.keyDown(link, { key: "Enter" });
    expect(tookOver).toBe(true);
    await closed(view);
  });

  it("leaves an item that is no link as it was", async () => {
    const onSelect = vi.fn();
    const view = render(<LinkMenu onSelect={onSelect} />);
    fireEvent.click(await view.findByRole("menuitem", { name: "Rename" }), {
      ctrlKey: true,
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    await closed(view);
  });
});

describe("DropdownMenuSubTrigger as a link", () => {
  // What a router's link went to: it goes in place on a plain click left to it.
  const went: string[] = [];
  function SubLinkMenu({
    router = true,
    onOpenChange,
    onSubOpenChange,
  }: {
    router?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSubOpenChange?: (open: boolean) => void;
  }) {
    return (
      <DropdownMenu defaultOpen onOpenChange={onOpenChange}>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Rename</DropdownMenuItem>
          <DropdownMenuSub onOpenChange={onSubOpenChange}>
            <DropdownMenuSubTrigger asChild>
              <a
                href="/new"
                onClick={(event) => {
                  if (!router || !isPlainClick(event)) return;
                  event.preventDefault();
                  went.push("/new");
                }}
              >
                New in
              </a>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Atlas</DropdownMenuItem>
              <DropdownMenuItem>Beacon</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  let tookOver: boolean | undefined;
  const stop = (event: MouseEvent) => {
    tookOver = event.defaultPrevented;
    event.preventDefault();
  };
  beforeEach(() => {
    tookOver = undefined;
    went.length = 0;
    window.addEventListener("click", stop);
  });
  afterEach(() => window.removeEventListener("click", stop));

  const trigger = (view: ReturnType<typeof render>) =>
    view.findByRole("menuitem", { name: "New in" });
  const press = (target: Element, pointerType: string, keys = {}) => {
    fireEvent.pointerDown(target, { button: 0, pointerType, ...keys });
    fireEvent.click(target, keys);
  };
  const closed = (view: ReturnType<typeof render>) =>
    waitFor(() => expect(view.queryByRole("menu")).toBeNull());

  it("goes and closes the menu on a router link's plain click", async () => {
    const view = render(<SubLinkMenu />);
    press(await trigger(view), "mouse");
    expect(went).toEqual(["/new"]);
    await closed(view);
  });

  it("goes and closes the menu on a plain link's click, leaving the submenu shut", async () => {
    const onSubOpenChange = vi.fn();
    const view = render(
      <SubLinkMenu router={false} onSubOpenChange={onSubOpenChange} />,
    );
    press(await trigger(view), "mouse");
    // The browser goes.
    expect(tookOver).toBe(false);
    await closed(view);
    expect(onSubOpenChange).not.toHaveBeenCalledWith(true);
  });

  it("goes and closes the menu on a click once hovering opened the submenu", async () => {
    const view = render(<SubLinkMenu />);
    const link = await trigger(view);
    fireEvent.pointerMove(link, { pointerType: "mouse" });
    await view.findByRole("menuitem", { name: "Atlas" });
    press(link, "mouse");
    expect(went).toEqual(["/new"]);
    await closed(view);
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["⌘", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["Alt", { altKey: true }],
  ])(
    "leaves the menu open on a click with %s, to the browser",
    async (_, keys) => {
      const onOpenChange = vi.fn();
      const view = render(<SubLinkMenu onOpenChange={onOpenChange} />);
      press(await trigger(view), "mouse", keys);
      expect(tookOver).toBe(false);
      await act(async () => {});
      expect(view.getAllByRole("menu").length).toBeGreaterThan(0);
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    },
  );

  it.each(["touch", "pen"])(
    "opens the submenu on a %s tap and goes nowhere",
    async (pointerType) => {
      const onOpenChange = vi.fn();
      const view = render(<SubLinkMenu onOpenChange={onOpenChange} />);
      const link = await trigger(view);
      press(link, pointerType);
      expect(tookOver).toBe(true);
      expect(went).toEqual([]);
      await view.findByRole("menuitem", { name: "Atlas" });
      expect(link.getAttribute("aria-expanded")).toBe("true");
      expect(onOpenChange).not.toHaveBeenCalled();
    },
  );

  it("keeps the submenu open on a second tap, still going nowhere", async () => {
    const view = render(<SubLinkMenu router={false} />);
    const link = await trigger(view);
    press(link, "touch");
    await view.findByRole("menuitem", { name: "Atlas" });
    press(link, "touch");
    expect(tookOver).toBe(true);
    await act(async () => {});
    expect(view.getByRole("menuitem", { name: "Atlas" })).toBeTruthy();
  });

  it.each(["Enter", "ArrowRight"])(
    "opens the submenu on %s and goes nowhere",
    async (key) => {
      const view = render(<SubLinkMenu />);
      const link = await trigger(view);
      act(() => link.focus());
      fireEvent.keyDown(link, { key });
      await view.findByRole("menuitem", { name: "Atlas" });
      expect(went).toEqual([]);
      expect(view.getAllByRole("menu").length).toBe(2);
    },
  );

  it("still opens a trigger that is no link on a click", async () => {
    const view = render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Sort by</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Updated</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    press(await view.findByRole("menuitem", { name: "Sort by" }), "mouse");
    await view.findByRole("menuitem", { name: "Updated" });
    expect(view.getAllByRole("menu").length).toBe(2);
  });
});
