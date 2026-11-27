import { act } from "@testing-library/react";
import { vi } from "vitest";
import { FakeResizeObserver } from "./fake-resize-observer.ts";

/**
 * happy-dom lays nothing out, so a toolbar would read every width as 0 and
 * never move a part. This gives it a small model to read instead: an icon
 * 16px, a letter 7px, an icon button 28px (24 at `icon-sm`), the ⋯'s count
 * its letters plus 4px each side, at least 16px, and the ⋯ holding one 3px
 * and the count wider than its icon button, a text button its content plus
 * 10px each side and 6px between, a separator 9px, an input 200px, and the
 * row the width the test sets. Everything is 28px
 * tall, an input 32px, and a box as tall as its tallest child; a
 * `data-test-width` or `data-test-height` sets either. Out-of-flow elements
 * (`absolute`) keep their own size but add none to their parent's. `row` is
 * the `data-slot` of the element whose `clientWidth` is the width set.
 */
export function stubToolbarLayout(initial: number, row = "toolbar-row") {
  let rowWidth = initial;
  const inFlow = (el: Element) =>
    !(el.getAttribute("class") ?? "").split(/\s+/).includes("absolute") &&
    (el as HTMLElement).style?.display !== "none";
  const width = (el: Element): number => {
    const html = el as HTMLElement;
    if (html.dataset?.testWidth) return Number(html.dataset.testWidth);
    if (el.tagName.toLowerCase() === "svg") return 16;
    if (el.tagName === "INPUT") return 200;
    const slot = html.dataset?.slot;
    if (slot === "toolbar-label") return (el.textContent?.length ?? 0) * 7;
    if (slot === "toolbar-separator") return 9;
    if (slot === "toolbar-spacer") return 0;
    if (slot === "toolbar-overflow-count")
      return Math.max(16, (el.textContent?.length ?? 0) * 7 + 8);
    const size = html.dataset?.size;
    if (size?.startsWith("icon")) {
      const icon = size === "icon-sm" ? 24 : 28;
      const count = [...el.children].find(
        (kid) =>
          (kid as HTMLElement).dataset?.slot === "toolbar-overflow-count",
      );
      return count ? icon + 3 + width(count) : icon;
    }
    const kids = [...el.children].filter(inFlow).map(width);
    const text = [...el.childNodes]
      .filter((node) => node.nodeType === 3)
      .reduce(
        (sum, node) => sum + (node.textContent?.trim().length ?? 0) * 7,
        0,
      );
    const parts = kids.length + (text > 0 ? 1 : 0);
    const content = kids.reduce((sum, w) => sum + w, 0) + text;
    if (size) return 20 + content + 6 * Math.max(parts - 1, 0);
    return content;
  };
  const height = (el: Element): number => {
    const html = el as HTMLElement;
    if (html.dataset?.testHeight) return Number(html.dataset.testHeight);
    if (el.tagName === "INPUT") return 32;
    return Math.max(28, ...[...el.children].filter(inFlow).map(height));
  };
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  const rect = vi
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: Element) {
      return DOMRect.fromRect({
        x: 0,
        y: 0,
        width: width(this),
        height: height(this),
      });
    });
  // happy-dom defines it on HTMLElement, below Element.
  const client = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientWidth",
  );
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: Element) {
      return (this as HTMLElement).dataset?.slot === row
        ? rowWidth
        : width(this);
    },
  });
  return {
    /** Resizes the row and lets the toolbar hear of it. */
    async resize(next: number) {
      rowWidth = next;
      await act(async () => {
        for (const observer of FakeResizeObserver.instances) observer.fire();
      });
    },
    restore() {
      rect.mockRestore();
      if (client)
        Object.defineProperty(HTMLElement.prototype, "clientWidth", client);
      else Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
      FakeResizeObserver.instances = [];
      vi.unstubAllGlobals();
    },
  };
}
