import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  POINTER_HOLD_DISTANCE,
  usePointerHold,
} from "../src/hooks/use-pointer-hold.ts";

/** A region 100×100 at (100, 100), laid out as happy-dom never does. */
function region() {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    DOMRect.fromRect({ x: 100, y: 100, width: 100, height: 100 });
  document.body.append(el);
  return el;
}

function Probe({
  regions,
  enabled = true,
}: {
  regions: () => readonly (Element | null)[];
  enabled?: boolean;
}) {
  const held = usePointerHold(regions, enabled);
  return <output>{held ? "held" : "free"}</output>;
}

const state = (container: HTMLElement) =>
  container.querySelector("output")?.textContent;

function pointer(type: "pointermove" | "pointerdown", x: number, y: number) {
  act(() => {
    window.dispatchEvent(
      new PointerEvent(type, { clientX: x, clientY: y, bubbles: true }),
    );
  });
}

describe("usePointerHold", () => {
  it("holds from the moment the pointer is on a region until it has gone the distance", () => {
    const el = region();
    const { container } = render(<Probe regions={() => [el]} />);
    pointer("pointermove", 20, 20);
    expect(state(container)).toBe("free");
    pointer("pointermove", 150, 150);
    expect(state(container)).toBe("held");
    // Off the region, but not far: overshooting an edge is no leave.
    pointer("pointermove", 200 + POINTER_HOLD_DISTANCE, 150);
    expect(state(container)).toBe("held");
    pointer("pointermove", 201 + POINTER_HOLD_DISTANCE, 150);
    expect(state(container)).toBe("free");
    // Coming near again is not enough: only the region takes it.
    pointer("pointermove", 210, 150);
    expect(state(container)).toBe("free");
    el.remove();
  });

  it("lets go at once on a key, a press or a wheel off the regions, but not on them", () => {
    const el = region();
    const { container } = render(<Probe regions={() => [el]} />);
    pointer("pointermove", 150, 150);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 10 }));
    });
    pointer("pointerdown", 150, 150);
    expect(state(container)).toBe("held");

    pointer("pointermove", 210, 150);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    });
    expect(state(container)).toBe("free");

    pointer("pointermove", 150, 150);
    pointer("pointermove", 210, 150);
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 10 }));
    });
    expect(state(container)).toBe("free");

    pointer("pointermove", 150, 150);
    pointer("pointerdown", 210, 150);
    expect(state(container)).toBe("free");
    el.remove();
  });

  it("counts every region it is given, read as the pointer moves", () => {
    const first = region();
    const second = document.createElement("div");
    second.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 400, y: 100, width: 100, height: 100 });
    let regions: Element[] = [first];
    const { container } = render(<Probe regions={() => regions} />);
    pointer("pointermove", 150, 150);
    regions = [first, second];
    // Straight from one to the other, past the distance from the first.
    pointer("pointermove", 450, 150);
    expect(state(container)).toBe("held");
    first.remove();
  });

  it("starts held when the pointer is already on a region, and is free while disabled", () => {
    const el = region();
    pointer("pointermove", 150, 150);
    const { container, rerender } = render(
      <Probe regions={() => [el]} enabled={false} />,
    );
    expect(state(container)).toBe("free");
    rerender(<Probe regions={() => [el]} />);
    expect(state(container)).toBe("held");
    rerender(<Probe regions={() => [el]} enabled={false} />);
    expect(state(container)).toBe("free");
    el.remove();
  });
});
