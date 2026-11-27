import { useEffect, useRef, useState } from "react";

/**
 * How far, in CSS pixels, the pointer may stray from the regions before a
 * hold lets go: past a row's height, so overshooting a row's edge on the way
 * to the next one is no leave, and short of anywhere else worth reaching.
 */
export const POINTER_HOLD_DISTANCE = 48;

/** The pointer's last place in the window, by any pointer, a touch's included. */
let last: { x: number; y: number } | null = null;
let tracking = false;

// Kept from the first hold on, so a hold that starts with the pointer
// already inside a region (a menu opening under it) knows so.
function track() {
  if (tracking || typeof window === "undefined") return;
  tracking = true;
  const note = (event: PointerEvent) => {
    last = { x: event.clientX, y: event.clientY };
  };
  const options = { capture: true, passive: true };
  window.addEventListener("pointermove", note, options);
  window.addEventListener("pointerdown", note, options);
}

/** From the point to the nearest region, 0 inside one; Infinity without any drawn. */
function distanceTo(
  regions: readonly (Element | null | undefined)[],
  x: number,
  y: number,
): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const region of regions) {
    if (!region) continue;
    const r = region.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    nearest = Math.min(nearest, Math.hypot(dx, dy));
  }
  return nearest;
}

/**
 * Whether the pointer is on `regions`, or was and has not gone far: true from
 * the moment it is over one, until it is more than `POINTER_HOLD_DISTANCE`
 * from all of them, or until, outside them, a key, a press or a wheel says it
 * is no longer on its way back. A part that would move as its content changes
 * (a menu whose trigger the bar moves, a dialog whose height follows a zoom)
 * keeps still while held, so it does not slide out from under the pointer.
 *
 * `regions` is read at each event, so it may name elements that mount later.
 * Disabled, it is false.
 */
export function usePointerHold(
  regions: () => readonly (Element | null | undefined)[],
  enabled = true,
): boolean {
  const [held, setHeld] = useState(false);
  const regionsRef = useRef(regions);
  regionsRef.current = regions;
  useEffect(() => {
    track();
    if (!enabled) {
      setHeld(false);
      return;
    }
    let on = false;
    const set = (next: boolean) => {
      if (on === next) return;
      on = next;
      setHeld(next);
    };
    const away = (x: number, y: number) =>
      distanceTo(regionsRef.current(), x, y);
    if (last) set(away(last.x, last.y) === 0);
    const move = (event: PointerEvent) => {
      const d = away(event.clientX, event.clientY);
      if (d === 0) set(true);
      else if (d > POINTER_HOLD_DISTANCE) set(false);
    };
    const press = (event: PointerEvent) =>
      set(away(event.clientX, event.clientY) === 0);
    const settle = () => {
      if (last && away(last.x, last.y) > 0) set(false);
    };
    const passive = { capture: true, passive: true };
    window.addEventListener("pointermove", move, passive);
    window.addEventListener("pointerdown", press, passive);
    window.addEventListener("keydown", settle, true);
    window.addEventListener("wheel", settle, passive);
    return () => {
      window.removeEventListener("pointermove", move, passive);
      window.removeEventListener("pointerdown", press, passive);
      window.removeEventListener("keydown", settle, true);
      window.removeEventListener("wheel", settle, passive);
      setHeld(false);
    };
  }, [enabled]);
  return enabled && held;
}
