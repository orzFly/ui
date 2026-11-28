type Side = "top" | "right" | "bottom" | "left";

/** What Radix's `collisionPadding` takes: one gap, or one per side. */
export type CollisionPadding = number | Partial<Record<Side, number>>;

// Floating UI places a surface at fractional coordinates, sizes its
// available-room variables from them, and then rounds the transform to the
// device pixel: up to half a device pixel either way, so at most 0.5px at any
// ratio from 1 up. A surface the size middleware caps keeps its height while
// the rounding carries it down (UI-291), and one shift pins to the right edge
// moves right with it when its own width is fractional, so its far edge lands
// that much inside the padding. The near edges need nothing: a position at or
// past an integer padding rounds to at or past it.
const ROUNDING = 0.5;

/**
 * `padding` as the gap a surface's rendered edges keep from the viewport, after
 * Floating UI rounds its position: what to pass Radix's `collisionPadding`.
 */
export function roundedEdgePadding(
  padding: CollisionPadding,
): Partial<Record<Side, number>> {
  const sides =
    typeof padding === "number"
      ? { top: padding, right: padding, bottom: padding, left: padding }
      : padding;
  return {
    ...sides,
    right: (sides.right ?? 0) + ROUNDING,
    bottom: (sides.bottom ?? 0) + ROUNDING,
  };
}
