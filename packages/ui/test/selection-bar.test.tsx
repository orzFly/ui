import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SelectionBar } from "../src/components/selection-bar.tsx";

function Harness({ initial, total = 5 }: { initial: number; total?: number }) {
  const [count, setCount] = useState(initial);
  return (
    <SelectionBar
      count={count}
      total={total}
      onSelectAll={() => setCount(total)}
      onClear={() => setCount(0)}
      idle={<span>Inbox</span>}
    >
      <button type="button">Archive</button>
    </SelectionBar>
  );
}

const checkbox = () => screen.getByRole("checkbox", { name: "Select all" });

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
});
