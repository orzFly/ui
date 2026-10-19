import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useElementHeight } from "../src/hooks/use-element-height.ts";

/**
 * happy-dom has no layout engine: `getBoundingClientRect()` answers 0 for
 * every element, whatever its styles say. So the height has to be stubbed
 * per element, and no test in this suite can assert what a real element
 * comes to at a given viewport — that stays a browser check (T-232).
 */
function elementOf(height: number): HTMLElement {
  const element = document.createElement("header");
  element.getBoundingClientRect = () => ({ height }) as DOMRect;
  document.body.append(element);
  return element;
}

const findHeader = () => document.querySelector("header");

afterEach(() => {
  for (const header of document.querySelectorAll("header")) header.remove();
});

describe("useElementHeight", () => {
  it("takes the height off the element rather than assuming one", () => {
    // 56 is a fallback, not an answer (T-233). An element that measures
    // anything else has to come back as that.
    elementOf(97);
    expect(
      renderHook(() => useElementHeight(findHeader, 56)).result.current,
    ).toBe(97);
  });

  it("follows the element when it gains or loses a row", () => {
    const element = elementOf(97);
    const { result } = renderHook(() => useElementHeight(findHeader, 56));
    expect(result.current).toBe(97);

    element.getBoundingClientRect = () => ({ height: 57 }) as DOMRect;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(result.current).toBe(57);
  });

  it("stands on the fallback while there is nothing to measure", () => {
    expect(
      renderHook(() => useElementHeight(findHeader, 56)).result.current,
    ).toBe(56);
  });

  it("measures whatever a fresh closure per render points at", () => {
    const element = elementOf(40);
    const { result, rerender } = renderHook(() =>
      useElementHeight(() => element, 0),
    );
    rerender();
    expect(result.current).toBe(40);
  });
});
