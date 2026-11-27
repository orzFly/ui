import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
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
