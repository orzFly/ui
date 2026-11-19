import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../src/components/dropdown-menu.tsx";

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
