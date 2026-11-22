/** The band along a scroller's top and bottom edges where a drag scrolls it. */
export const EDGE_PX = 40;
/** The most a drag scrolls in one frame, at the very edge or past it. */
export const EDGE_SPEED = 18;

/**
 * The nearest ancestor of `el` that scrolls, or none when the document does.
 * Looked up each time rather than kept, as the element may have moved.
 */
export function scrollerOf(el: HTMLElement): HTMLElement | undefined {
  const body = el.ownerDocument.body;
  for (let up = el.parentElement; up && up !== body; up = up.parentElement) {
    const { overflowY } = getComputedStyle(up);
    if (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay"
    )
      return up;
  }
  return undefined;
}

/**
 * The top and bottom of what `scroller` shows, inside its border, in the
 * viewport's coordinates; the window's when there is no scroller.
 */
export function scrollerEdges(
  el: HTMLElement,
  scroller: HTMLElement | undefined,
): { top: number; bottom: number } {
  if (!scroller) {
    return { top: 0, bottom: el.ownerDocument.defaultView?.innerHeight ?? 0 };
  }
  const top = scroller.getBoundingClientRect().top + scroller.clientTop;
  return { top, bottom: top + scroller.clientHeight };
}

/**
 * How far to scroll this frame for a pointer at `y` between edges `top` and
 * `bottom`: negative near the top, positive near the bottom, faster the
 * nearer it is, and 0 outside both bands.
 */
export function edgeScrollBy(y: number, top: number, bottom: number): number {
  const speed = (distance: number) =>
    Math.ceil(((EDGE_PX - Math.max(0, distance)) / EDGE_PX) * EDGE_SPEED);
  if (y < top + EDGE_PX) return -speed(y - top);
  if (y > bottom - EDGE_PX) return speed(bottom - y);
  return 0;
}
