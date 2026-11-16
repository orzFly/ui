import { vi } from "vitest";

export const H = 10;
export const VIEWPORT = 100;

/**
 * happy-dom lays nothing out: rows stand `H` px tall at their index, in a
 * scroller marked `data-scroller` showing `VIEWPORT` px, or on a page with
 * none.
 */
export function stubLayout() {
  const state = { scrollTop: 0 };
  const proto = HTMLElement.prototype;
  const own = ["scrollTop", "clientHeight"].map(
    (key) => [key, Object.getOwnPropertyDescriptor(proto, key)] as const,
  );
  const base = (key: string) => {
    for (
      let p = Object.getPrototypeOf(proto);
      p;
      p = Object.getPrototypeOf(p)
    ) {
      const d = Object.getOwnPropertyDescriptor(p, key);
      if (d) return d;
    }
    return undefined;
  };
  const scrollTop = base("scrollTop");
  const clientHeight = base("clientHeight");
  Object.defineProperty(proto, "scrollTop", {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute("data-scroller")
        ? state.scrollTop
        : scrollTop?.get?.call(this);
    },
    set(this: HTMLElement, value: number) {
      if (this.hasAttribute("data-scroller"))
        state.scrollTop = Math.max(0, value);
      else scrollTop?.set?.call(this, value);
    },
  });
  Object.defineProperty(proto, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute("data-scroller")
        ? VIEWPORT
        : clientHeight?.get?.call(this);
    },
  });
  const rect = (top: number, height: number) =>
    ({ top, height, bottom: top + height, left: 0, right: 0 }) as DOMRect;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      if (this.hasAttribute("data-scroller")) return rect(0, VIEWPORT);
      const slot = this.getAttribute("data-slot");
      if (slot === "tree") return rect(-state.scrollTop, 0);
      const index = this.getAttribute("data-index");
      if (slot === "tree-row" && index !== null)
        return rect(Number(index) * H - state.scrollTop, H);
      return rect(0, 0);
    },
  );
  const scrollBy = vi.fn();
  vi.spyOn(window, "scrollBy").mockImplementation(scrollBy);
  return {
    state,
    scrollBy,
    restore() {
      for (const [key, d] of own) {
        if (d) Object.defineProperty(proto, key, d);
        else delete (proto as unknown as Record<string, unknown>)[key];
      }
      vi.restoreAllMocks();
    },
  };
}

export type Layout = ReturnType<typeof stubLayout>;

/**
 * Rows across, on top of `stubLayout`: a row runs from 0 to 200, an item's
 * leading icon from 20 to 36 and its label from 44, which a label leading
 * with no icon starts at too. happy-dom gives the item no gap.
 */
export function stubIcons() {
  const spy = vi.mocked(Element.prototype.getBoundingClientRect);
  const down = spy.getMockImplementation();
  spy.mockImplementation(function (this: Element) {
    const r = down?.call(this) ?? ({} as DOMRect);
    const across = (left: number, right: number) =>
      ({ ...r, left, right, width: right - left }) as DOMRect;
    const slot = this.getAttribute("data-slot");
    if (slot === "tree-row") return across(0, 200);
    if (slot === "tree-label") return across(44, 150);
    if (this.parentElement?.getAttribute("data-slot") === "tree-item")
      return this === this.parentElement.firstElementChild
        ? across(20, 36)
        : across(150, 160);
    return r;
  });
}
