import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOverlayScrollbars } from "../src/hooks/use-overlay-scrollbars.ts";

function Scroller() {
  const { slot, viewport } = useOverlayScrollbars(true);
  return createElement(
    "div",
    { ref: slot, "data-testid": "slot" },
    createElement("div", { ref: viewport, "data-testid": "viewport" }, "rows"),
  );
}

const built = (element: HTMLElement) =>
  element.hasAttribute("data-overlayscrollbars");

describe("useOverlayScrollbars", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // Building an instance forces a layout of the page, and a board's columns
  // built theirs back to back inside the task that committed them.
  it("builds the instance in an idle callback, not in the commit", () => {
    const pending: IdleRequestCallback[] = [];
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
      pending.push(callback);
      return pending.length;
    });
    vi.stubGlobal("cancelIdleCallback", () => {});
    const view = render(createElement(Scroller));
    const viewport = view.getByTestId("viewport");
    expect(built(viewport)).toBe(false);
    act(() => {
      for (const callback of pending.splice(0)) {
        callback({ didTimeout: false, timeRemaining: () => 50 });
      }
    });
    expect(built(viewport)).toBe(true);
    view.unmount();
    expect(built(viewport)).toBe(false);
  });

  it("falls back to a timeout without idle callbacks, and cancels it on unmount", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const view = render(createElement(Scroller));
    const viewport = view.getByTestId("viewport");
    view.unmount();
    act(() => {
      vi.runAllTimers();
    });
    expect(built(viewport)).toBe(false);
  });
});
