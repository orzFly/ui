import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenuItem } from "../src/components/dropdown-menu.tsx";
import {
  SplitButton,
  SplitButtonAction,
  SplitButtonMenu,
} from "../src/components/split-button.tsx";

function Merge({
  disabled,
  menuDisabled,
  onMerge = () => {},
  onSquash = () => {},
}: {
  disabled?: boolean;
  menuDisabled?: boolean;
  onMerge?: () => void;
  onSquash?: () => void;
}) {
  return (
    <SplitButton disabled={disabled}>
      <SplitButtonAction onClick={onMerge}>Merge</SplitButtonAction>
      <SplitButtonMenu triggerLabel="Merge options" disabled={menuDisabled}>
        <DropdownMenuItem onSelect={onSquash}>
          Squash and merge
        </DropdownMenuItem>
      </SplitButtonMenu>
    </SplitButton>
  );
}

describe("SplitButton", () => {
  it("is two buttons side by side, never one in the other", () => {
    render(<Merge />);
    const group = screen.getByRole("group");
    expect(group.dataset.slot).toBe("button-group");
    expect(group.hasAttribute("data-split-button")).toBe(true);
    const buttons = screen.getAllByRole("button");
    expect(
      buttons.map((b) => b.getAttribute("aria-label") ?? b.textContent),
    ).toEqual(["Merge", "Merge options"]);
    for (const button of buttons) {
      expect(button.parentElement).toBe(group);
      expect(button.querySelector("button")).toBeNull();
    }
  });

  it("does the usual thing on its command, and opens the others from its arrow", async () => {
    const onMerge = vi.fn();
    const onSquash = vi.fn();
    render(<Merge onMerge={onMerge} onSquash={onSquash} />);
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    expect(onMerge).toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("button", { name: "Merge options" }), {
      key: "Enter",
    });
    await act(async () => {});
    fireEvent.click(screen.getByRole("menuitem", { name: "Squash and merge" }));
    expect(onSquash).toHaveBeenCalled();
  });

  it("is an outline button outside a toolbar, its halves joined", () => {
    render(<Merge />);
    const action = screen.getByRole("button", { name: "Merge" });
    const arrow = screen.getByRole("button", { name: "Merge options" });
    expect(action.dataset.variant).toBe("outline");
    expect(action.className).toContain("rounded-e-none");
    expect(arrow.className).toContain("rounded-s-none");
  });

  it("renders its command through asChild as a link", () => {
    render(
      <SplitButton>
        <SplitButtonAction asChild>
          <a href="/pulls/1/merge">Merge</a>
        </SplitButtonAction>
        <SplitButtonMenu triggerLabel="Merge options">
          <DropdownMenuItem>Squash and merge</DropdownMenuItem>
        </SplitButtonMenu>
      </SplitButton>,
    );
    const link = screen.getByRole("link", { name: "Merge" });
    expect(link.getAttribute("href")).toBe("/pulls/1/merge");
    expect(link.hasAttribute("type")).toBe(false);
  });

  it("disables both halves, or the arrow alone", () => {
    const { rerender } = render(<Merge disabled />);
    expect(
      screen
        .getAllByRole("button")
        .map((b) => (b as HTMLButtonElement).disabled),
    ).toEqual([true, true]);
    rerender(<Merge menuDisabled />);
    expect(
      screen
        .getAllByRole("button")
        .map((b) => (b as HTMLButtonElement).disabled),
    ).toEqual([false, true]);
  });

  it("draws each half the touch spacing wide on touch, with no room between them", () => {
    render(<Merge />);
    const arrow = screen.getByRole("button", { name: "Merge options" });
    const classes = arrow.className.split(/\s+/);
    // An icon size reserves room beside it, which a button group parts nothing with.
    expect(classes).toContain("in-data-[slot=button-group]:mx-0");
    expect(classes).toContain("in-data-[slot=button-group]:touch:min-w-touch");
    expect(classes).toContain("touch:hit-area");
    const action = screen.getByRole("button", { name: "Merge" });
    expect(action.className.split(/\s+/)).toContain("touch:min-w-touch");
  });
});
