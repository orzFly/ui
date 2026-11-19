import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useSelection } from "../src/hooks/use-selection.ts";

const render = (keys: number[]) =>
  renderHook(({ keys }) => useSelection(keys), {
    initialProps: { keys },
  });

describe("useSelection", () => {
  it("toggles keys and reports them in list order", () => {
    const view = render([1, 2, 3, 4]);
    act(() => view.result.current.toggle(3));
    act(() => view.result.current.toggle(1));
    expect(view.result.current.selected).toEqual([1, 3]);
    expect(view.result.current.state).toBe("some");
    act(() => view.result.current.toggle(3));
    expect(view.result.current.selected).toEqual([1]);
    expect(view.result.current.isSelected(1)).toBe(true);
    expect(view.result.current.isSelected(3)).toBe(false);
  });

  it("extends from the last toggled key to the shift-clicked one", () => {
    const view = render([1, 2, 3, 4, 5]);
    act(() => view.result.current.toggle(4));
    act(() => view.result.current.toggle(2, { extend: true }));
    expect(view.result.current.selected).toEqual([2, 3, 4]);
    // The range takes the clicked key's new state, so a shift-click on a
    // selected key clears the span back to the anchor.
    act(() => view.result.current.toggle(3, { extend: true }));
    expect(view.result.current.selected).toEqual([4]);
  });

  it("extends from nothing as a plain toggle", () => {
    const view = render([1, 2, 3]);
    act(() => view.result.current.toggle(3, { extend: true }));
    expect(view.result.current.selected).toEqual([3]);
  });

  it("selects all from a partial selection, and none from all", () => {
    const view = render([1, 2, 3]);
    act(() => view.result.current.toggle(2));
    act(() => view.result.current.toggleAll());
    expect(view.result.current.state).toBe("all");
    act(() => view.result.current.toggleAll());
    expect(view.result.current.state).toBe("none");
  });

  it("drops a key that leaves the list, and the next change forgets it", () => {
    const view = render([1, 2, 3]);
    act(() => view.result.current.toggleAll());
    view.rerender({ keys: [1, 3] });
    expect(view.result.current.selected).toEqual([1, 3]);
    expect(view.result.current.state).toBe("all");
    act(() => view.result.current.toggle(1));
    view.rerender({ keys: [1, 2, 3] });
    expect(view.result.current.selected).toEqual([3]);
  });

  it("selects a group, reports it, and clears it once all of it is selected", () => {
    const view = render([1, 2, 3, 4]);
    act(() => view.result.current.toggle(2));
    expect(view.result.current.groupState([2, 3])).toBe("some");
    act(() => view.result.current.toggleGroup([2, 3]));
    expect(view.result.current.selected).toEqual([2, 3]);
    expect(view.result.current.groupState([2, 3])).toBe("all");
    expect(view.result.current.groupState([4])).toBe("none");
    act(() => view.result.current.toggle(4));
    act(() => view.result.current.toggleGroup([2, 3]));
    expect(view.result.current.selected).toEqual([4]);
  });

  it("builds on a paint that has not rendered yet", () => {
    const view = render([1, 2, 3, 4]);
    act(() => {
      view.result.current.paint([1], true);
      view.result.current.paint([2, 3], true);
    });
    expect(view.result.current.selected).toEqual([1, 2, 3]);
    act(() => view.result.current.paint([2, 4], false));
    expect(view.result.current.selected).toEqual([1, 3]);
    // The last key painted is where a shift-click extends from.
    act(() => view.result.current.toggle(2, { extend: true }));
    expect(view.result.current.selected).toEqual([1, 2, 3, 4]);
  });

  it("clears, and a shift-click after it extends from nothing", () => {
    const view = render([1, 2, 3]);
    act(() => view.result.current.toggle(1));
    act(() => view.result.current.clear());
    expect(view.result.current.state).toBe("none");
    act(() => view.result.current.toggle(3, { extend: true }));
    expect(view.result.current.selected).toEqual([3]);
  });

  it("leaves the selection to the app that holds it", () => {
    const heard = vi.fn();
    const view = renderHook(() => {
      const [selected, setSelected] = useState<number[]>([3, 9]);
      return useSelection([1, 2, 3], {
        selected,
        onSelectedChange: (next) => {
          heard(next);
          setSelected(next);
        },
      });
    });
    // 9 is in no list, so it counts for nothing.
    expect(view.result.current.selected).toEqual([3]);
    act(() => view.result.current.toggle(1, { extend: true }));
    expect(heard).toHaveBeenLastCalledWith([1, 3]);
    expect(view.result.current.selected).toEqual([1, 3]);
  });

  it("stays where the app holding it leaves it", () => {
    const heard = vi.fn();
    const view = renderHook(() =>
      useSelection([1, 2, 3], { selected: [], onSelectedChange: heard }),
    );
    act(() => view.result.current.toggle(1));
    expect(heard).toHaveBeenLastCalledWith([1]);
    view.rerender();
    expect(view.result.current.selected).toEqual([]);
    // The next change starts from what is shown, not from what was asked.
    act(() => view.result.current.toggle(2));
    expect(heard).toHaveBeenLastCalledWith([2]);
  });

  it("starts from defaultSelected", () => {
    const view = renderHook(() =>
      useSelection([1, 2, 3], { defaultSelected: [2] }),
    );
    expect(view.result.current.selected).toEqual([2]);
  });
});
