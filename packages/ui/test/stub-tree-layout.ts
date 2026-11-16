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
