import { vi } from "vitest";

/** A row's height, unless it sets `data-test-height`. */
export const H = 30;
/** A group's heading, above its rows. */
export const HEAD = 20;
/** What an empty group shows in place of rows. */
export const EMPTY = 30;
/** What a scroller marked `data-scroller` shows. */
export const VIEWPORT = 200;

const translateY = (el: Element) => {
  const m = /translateY\((-?[\d.]+)px\)/.exec(
    (el as HTMLElement).style?.transform ?? "",
  );
  return m ? Number(m[1]) : 0;
};

const rect = (top: number, height: number) =>
  ({
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 200,
    width: 200,
    x: 0,
    y: top,
  }) as DOMRect;

/**
 * happy-dom lays nothing out. Under each `Reorder` its groups and rows stand
 * in document order: a group is its `HEAD` and then its rows, or `EMPTY` when
 * it has none, and a row is `H` tall. Each element is drawn where its layout
 * puts it plus its own `translateY` and its group's, as a browser draws them.
 * A root inside a `data-scroller` starts at its top, less the scroll.
 *
 * `getComputedStyle` reads a transform from the inline style, or from
 * `sliding` for an element caught mid-slide; with `motion` on, an element
 * marked `data-shifting` has a transition, so a slide waits for its end.
 */
export function stubReorderLayout() {
  const state = {
    scrollTop: 0,
    motion: false,
    sliding: new Map<Element, number>(),
  };
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

  const mine = (root: Element, el: Element) =>
    el.parentElement?.closest('[data-slot="reorder"]') === root;

  function layout(root: Element) {
    const boxes = new Map<Element, { top: number; height: number }>();
    const rootTop = root.closest("[data-scroller]") ? -state.scrollTop : 0;
    let y = rootTop;
    const rowsIn = (el: Element) =>
      [...el.querySelectorAll('[data-slot="reorder-item"]')].filter((row) =>
        mine(root, row),
      );
    const row = (el: Element) => {
      const height = Number(el.getAttribute("data-test-height") ?? H);
      boxes.set(el, { top: y, height });
      y += height;
    };
    const groups = [
      ...root.querySelectorAll('[data-slot="reorder-group"]'),
    ].filter((g) => mine(root, g));
    if (groups.length === 0) {
      for (const el of rowsIn(root)) row(el);
    } else {
      for (const group of groups) {
        const top = y;
        y += HEAD;
        const rows = rowsIn(group);
        if (rows.length === 0) y += EMPTY;
        for (const el of rows) row(el);
        boxes.set(group, { top, height: y - top });
      }
    }
    boxes.set(root, { top: rootTop, height: y - rootTop });
    return boxes;
  }

  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      if (this.hasAttribute("data-scroller")) return rect(0, VIEWPORT);
      const root = this.closest('[data-slot="reorder"]');
      if (!root) return rect(0, 0);
      const box = layout(root).get(this);
      if (!box) return rect(0, 0);
      let top = box.top + translateY(this);
      const group = this.parentElement?.closest('[data-slot="reorder-group"]');
      if (group && this !== root && mine(root, group))
        top += state.sliding.get(group) ?? translateY(group);
      return rect(top, box.height);
    },
  );

  const real = globalThis.getComputedStyle.bind(globalThis);
  vi.spyOn(globalThis, "getComputedStyle").mockImplementation(
    (el: Element, pseudo?: string | null) => {
      const style = real(el, pseudo);
      return new Proxy(style, {
        get(target, prop) {
          const shifting = state.motion && el.hasAttribute("data-shifting");
          if (prop === "transform") {
            const sliding = state.sliding.get(el);
            if (sliding !== undefined)
              return `matrix(1, 0, 0, 1, 0, ${sliding})`;
            return (el as HTMLElement).style.transform || "none";
          }
          if (prop === "transitionProperty")
            return shifting ? "transform" : "none";
          if (prop === "transitionDuration") return shifting ? "0.15s" : "0s";
          const value = Reflect.get(target, prop, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
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

export type ReorderLayout = ReturnType<typeof stubReorderLayout>;
