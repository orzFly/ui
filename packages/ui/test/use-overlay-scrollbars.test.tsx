import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, render } from "@testing-library/react";
import type { PartialOptions } from "overlayscrollbars";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOverlayScrollbars } from "../src/hooks/use-overlay-scrollbars.ts";

function Scroller({ options }: { options?: PartialOptions }) {
  const { slot, viewport } = useOverlayScrollbars(true, options);
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

describe("the os-theme-orz theme", () => {
  const read = (path: string) =>
    readFileSync(join(import.meta.dirname, "..", path), "utf8");
  const library = read(
    "node_modules/overlayscrollbars/styles/overlayscrollbars.css",
  );
  // styles.css as a whole is Tailwind source, which happy-dom does not parse.
  const theme =
    read("styles.css").match(/^[^\n{]*os-theme-orz[^{]*\{[^}]*\}/m)?.[0] ?? "";
  const size = theme.match(/--os-size:\s*([^;]+);/)?.[1];

  afterEach(() => {
    // Before the stubs go: unmounting cancels the idle callback.
    cleanup();
    vi.unstubAllGlobals();
    for (const style of document.head.querySelectorAll("style")) style.remove();
  });

  function verticalBar(sheets: string[], options?: PartialOptions) {
    for (const css of sheets) {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
    }
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });
    vi.stubGlobal("cancelIdleCallback", () => {});
    const view = render(createElement(Scroller, { options }));
    const bar = view
      .getByTestId("slot")
      .querySelector<HTMLElement>(".os-scrollbar-vertical");
    if (bar === null) throw new Error("no vertical bar was built");
    return getComputedStyle(bar);
  }

  // overlayscrollbars.css resets every --os-* on .os-scrollbar, the element
  // the theme class lands on, and an app imports it on its own; imported
  // after styles.css, it drew the bar 0px wide (UI-247).
  it.each([
    ["before", [library, theme]],
    ["after", [theme, library]],
  ])("sizes the bar with overlayscrollbars.css %s styles.css", (_, sheets) => {
    expect(size).toBeDefined();
    const bar = verticalBar(sheets);
    expect(bar.getPropertyValue("--os-size")).toBe(size);
    expect(bar.width).toBe(size);
  });

  const WIDE = { scrollbars: { theme: "os-theme-orz wide" } } as const;

  it.each([
    [".wide", size],
    [".os-scrollbar.wide", "12px"],
  ])("%s below styles.css draws the bar %s wide", (selector, width) => {
    const css = `${selector} { --os-size: 12px; }`;
    expect(verticalBar([library, theme, css], WIDE).width).toBe(width);
  });
});
