import { OverlayScrollbars, type PartialOptions } from "overlayscrollbars";
import { useEffect, useRef } from "react";

const DEFAULTS = {
  theme: "os-theme-orz",
  autoHide: "leave",
  autoHideSuspend: true,
  // `false`, the library's default, makes a track click do nothing at all —
  // less than the native behaviour it replaces. Paging instead of jumping
  // would cost a `ClickScrollPlugin` registration.
  clickScroll: "instant",
} as const satisfies PartialOptions["scrollbars"];

/** One level deep, so a caller's `scrollbars` adds to the defaults rather than replacing them. */
function merged(options: PartialOptions | undefined): PartialOptions {
  return {
    ...options,
    scrollbars: { ...DEFAULTS, ...options?.scrollbars },
  };
}

/**
 * Overlay scrollbars for a scroll container that stays exactly as it is: the
 * element `viewport` is on keeps its own classes, its own children and its own
 * native scrolling, and the bars are drawn in `slot`, a positioned parent
 * wrapped directly around it. Needs the `overlayscrollbars` peer, and the
 * consumer imports `overlayscrollbars/overlayscrollbars.css` itself.
 *
 * Both refs are needed. Letting the library build its own viewport moves the
 * children into an inserted div, where the container's `flex gap` no longer
 * reaches them; leaving out the slot leaves the bars inside the scroll
 * container, where they scroll away with the content. A slot further out than
 * the immediate parent draws the bar over whatever else it spans.
 *
 * `ready` withholds the instance until the caller's content is in the DOM.
 * `autoHideSuspend` shows the bar once on arrival — but it only arms when the
 * element already overflows at the moment the instance is created, and a
 * container whose content is still in flight does not. Initializing on mount
 * costs that one reveal outright. Until then the element scrolls natively.
 *
 * The instance is built in an idle callback after `ready`, not in the commit,
 * since building one forces a layout of the page. Hide the native bar on the
 * viewport from the start (`[scrollbar-width:none]`), or on a platform whose
 * bars take room the content narrows, then widens again when the overlay
 * arrives.
 *
 * `options` go over the defaults above. A container that must never scroll
 * sideways passes `{ overflow: { x: "hidden" } }`: Tailwind's
 * `overflow-y-auto` leaves x computing to `auto`. Pass a stable object — a new
 * identity is applied with `instance.options()`, which costs an update, though
 * never a re-initialization.
 */
export function useOverlayScrollbars(ready: boolean, options?: PartialOptions) {
  const slot = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const instance = useRef<OverlayScrollbars | null>(null);
  const latest = useRef(options);
  latest.current = options;
  // What the live instance was last given, so the mount does not apply the
  // options it was just created with a second time.
  const applied = useRef<PartialOptions | undefined>(undefined);

  useEffect(() => {
    const slotElement = slot.current;
    const viewportElement = viewport.current;
    if (!ready || slotElement === null || viewportElement === null) return;
    let created: OverlayScrollbars | null = null;
    const create = () => {
      created = OverlayScrollbars(
        {
          target: viewportElement,
          elements: { viewport: viewportElement },
          scrollbars: { slot: slotElement },
        },
        merged(latest.current),
      );
      instance.current = created;
      applied.current = latest.current;
    };
    const destroy = () => {
      instance.current = null;
      created?.destroy();
    };
    // Each instance forces a style and layout pass over the whole page as it
    // builds itself, about 50ms under a board of 150 cards; created in the
    // effect, a board's columns did it back to back inside the task that
    // committed them, one 340ms block. An idle callback apiece puts input
    // between them.
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(create, { timeout: 1000 });
      return () => {
        cancelIdleCallback(id);
        destroy();
      };
    }
    // Safari has no idle callbacks.
    const id = setTimeout(create, 0);
    return () => {
      clearTimeout(id);
      destroy();
    };
  }, [ready]);

  useEffect(() => {
    if (instance.current === null || applied.current === options) return;
    applied.current = options;
    // Pure, so a key the caller stopped passing falls back to its default
    // instead of keeping the value it was last given.
    instance.current.options(merged(options), true);
  }, [options]);

  return { slot, viewport };
}
