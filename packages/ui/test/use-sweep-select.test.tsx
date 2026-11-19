import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Checkbox } from "../src/components/checkbox.tsx";
import { useSelection } from "../src/hooks/use-selection.ts";
import { useSweepSelect } from "../src/hooks/use-sweep-select.ts";

// happy-dom has no layout, so rows are stacked by hand: row n spans
// y = 30n .. 30n + 29 across the whole width.
const ROW = 30;
const KEYS = [1, 2, 3, 4, 5, 6];

function List() {
  const selection = useSelection(KEYS);
  const sweep = useSweepSelect({
    isSelected: selection.isSelected,
    paint: selection.paint,
    parse: Number,
  });
  return (
    <ul onPointerDownCapture={sweep.onPointerDownCapture}>
      {KEYS.map((key) => (
        <li key={key} data-sweep-key={key} data-testid={`row-${key}`}>
          <label htmlFor={`box-${key}`} data-sweep-start="">
            <Checkbox
              id={`box-${key}`}
              aria-label={`select ${key}`}
              checked={selection.isSelected(key)}
              onClick={(e) => selection.toggle(key, { extend: e.shiftKey })}
            />
          </label>
          <span data-testid={`title-${key}`}>title {key}</span>
        </li>
      ))}
    </ul>
  );
}

const yOf = (key: number) => KEYS.indexOf(key) * ROW + ROW / 2;

let view: ReturnType<typeof render>;

beforeEach(() => {
  view = render(<List />);
  vi.spyOn(document, "elementFromPoint").mockImplementation((_x, y) => {
    const key = KEYS[Math.floor(y / ROW)];
    return key === undefined ? null : view.getByTestId(`title-${key}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const box = (key: number) => view.getByLabelText(`select ${key}`);
const checked = () =>
  KEYS.filter((key) => box(key).getAttribute("aria-checked") === "true");

function press(key: number, init: Partial<PointerEventInit> = {}) {
  fireEvent.pointerDown(box(key), {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: 5,
    clientY: yOf(key),
    ...init,
  });
}
function moveTo(key: number) {
  act(() => {
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 1,
        clientX: 5,
        clientY: yOf(key),
      }),
    );
  });
}
// Where the release lands decides where the browser sends its click: to the
// box it was pressed on when it comes back to it, and to an ancestor both
// ends share, no box, otherwise.
function release(onKey: number | null) {
  const target = onKey === null ? document.body : box(onKey);
  act(() => {
    target.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, bubbles: true }),
    );
  });
  if (onKey !== null) fireEvent.click(box(onKey));
}

describe("useSweepSelect", () => {
  it("adds every row crossed when it starts on an unchecked box", () => {
    press(2);
    moveTo(3);
    moveTo(4);
    release(null);
    expect(checked()).toEqual([2, 3, 4]);
  });

  it("removes, and leaves unchecked rows alone, when it starts on a checked box", () => {
    fireEvent.click(box(2));
    fireEvent.click(box(3));
    fireEvent.click(box(5));
    press(3);
    moveTo(4);
    moveTo(5);
    release(null);
    // 4 was unchecked and is crossed by a removing sweep: it stays off,
    // rather than flipping on as a toggle would.
    expect(checked()).toEqual([2]);
  });

  it("does not skip rows a fast move jumps over", () => {
    press(1);
    moveTo(6);
    release(null);
    expect(checked()).toEqual(KEYS);
  });

  it("sweeps back up as well as down", () => {
    press(5);
    moveTo(3);
    release(null);
    expect(checked()).toEqual([3, 4, 5]);
  });

  it("keeps the first box painted when released back on it", () => {
    press(2);
    moveTo(3);
    moveTo(2);
    release(2);
    expect(checked()).toEqual([2, 3]);
    // Only that one click is swallowed; the next one toggles again.
    fireEvent.click(box(2));
    expect(checked()).toEqual([3]);
  });

  it("is an ordinary click when the pointer never leaves the box", () => {
    press(2);
    release(2);
    expect(checked()).toEqual([2]);
  });

  it("extends a later shift-click from the last row painted", () => {
    press(1);
    moveTo(2);
    release(null);
    fireEvent.click(box(5), { shiftKey: true });
    expect(checked()).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps shift-click a range rather than a sweep", () => {
    fireEvent.click(box(1));
    press(3, { shiftKey: true });
    moveTo(4);
    release(null);
    fireEvent.click(box(3), { shiftKey: true });
    expect(checked()).toEqual([1, 2, 3]);
  });

  it("leaves touch to scroll the list", () => {
    press(2, { pointerType: "touch" });
    moveTo(4);
    release(null);
    expect(checked()).toEqual([]);
  });

  it("does not start from a row's text, only from its box", () => {
    fireEvent.pointerDown(view.getByTestId("title-2"), {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 5,
      clientY: yOf(2),
    });
    moveTo(4);
    release(null);
    expect(checked()).toEqual([]);
  });

  it("holds off text selection for the press and only for it", () => {
    const selectStart = () =>
      document.dispatchEvent(new Event("selectstart", { cancelable: true }));
    press(2);
    expect(selectStart()).toBe(false);
    moveTo(3);
    release(null);
    expect(selectStart()).toBe(true);
  });
});
