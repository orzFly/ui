import { type PointerEvent, useCallback, useEffect, useRef } from "react";

/** Marks what a sweep may start on: a row's checkbox, or the label around it. */
export const SWEEP_START = "data-sweep-start";
/** Marks what a sweep paints as the pointer crosses it, a row, with its key as the value. */
export const SWEEP_KEY = "data-sweep-key";

// Fine enough that a fast flick across 32px rows still lands in each one,
// coarse enough that a long one stays a handful of hit tests.
const STEP = 8;
const MAX_STEPS = 200;

export type SweepSelectOptions<K> = {
  isSelected: (key: K) => boolean;
  /** Sets the rows crossed to `on`; `useSelection`'s `paint`. */
  paint: (keys: readonly K[], on: boolean) => void;
  /** A row's key from its `data-sweep-key`; leave it out where the keys are strings. */
  parse?: (raw: string) => K;
};

/**
 * Drag across checkboxes to select many rows: a press on a row's box that moves off it paints
 * every row the pointer crosses with the state opposite to the first box's, so starting on an
 * unchecked box adds and on a checked one removes. A press that never leaves its box stays an
 * ordinary click, and a release back on it does not flip it back.
 *
 * Spread the handler on the element that holds the rows, mark each row `data-sweep-key` and
 * each box (or its label) `data-sweep-start`. Mouse and pen only: on touch the same motion is a
 * scroll. A press with Shift, Ctrl, ⌘ or Alt is left to the click it makes.
 */
export function useSweepSelect<K = string>(
  options: SweepSelectOptions<K>,
): { onPointerDownCapture: (event: PointerEvent<HTMLElement>) => void } {
  // Read when the pointer moves, long after the render that handed it in.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const onPointerDownCapture = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === "touch" || event.button !== 0) return;
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey)
        return;
      const root = event.currentTarget;
      const target = event.target as Element;
      const start = target.closest(`[${SWEEP_START}]`);
      if (!start || !root.contains(start)) return;
      const raw = target.closest(`[${SWEEP_KEY}]`)?.getAttribute(SWEEP_KEY);
      if (raw == null) return;
      stop.current?.();

      const parse = (value: string) =>
        latest.current.parse ? latest.current.parse(value) : (value as K);
      const on = !latest.current.isSelected(parse(raw));
      const pointerId = event.pointerId;
      const crossed = new Set<string>([raw]);
      let swept = false;
      let x = event.clientX;
      let y = event.clientY;

      const keyAt = (px: number, py: number) => {
        const row = document
          .elementFromPoint(px, py)
          ?.closest(`[${SWEEP_KEY}]`);
        return row && root.contains(row) ? row.getAttribute(SWEEP_KEY) : null;
      };

      const move = (e: globalThis.PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        const dx = e.clientX - x;
        const dy = e.clientY - y;
        const steps = Math.min(
          MAX_STEPS,
          Math.max(1, Math.ceil(Math.hypot(dx, dy) / STEP)),
        );
        const fresh: string[] = [];
        for (let i = 1; i <= steps; i++) {
          const key = keyAt(x + (dx * i) / steps, y + (dy * i) / steps);
          if (key === null || crossed.has(key)) continue;
          crossed.add(key);
          fresh.push(key);
        }
        x = e.clientX;
        y = e.clientY;
        if (fresh.length === 0) return;
        // The first box joins the sweep only once the pointer leaves it,
        // so a press that stays put is still the box's own click.
        if (!swept) fresh.unshift(raw);
        swept = true;
        window.getSelection()?.removeAllRanges();
        latest.current.paint(fresh.map(parse), on);
      };

      // The press began on a box, so any text it would drag out is the
      // titles it passes, which nobody meant to copy.
      const noSelect = (e: Event) => e.preventDefault();

      const end = (e: globalThis.PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        stop.current?.();
        // Released back on the first box, the browser still clicks it, which
        // would flip back what the sweep just painted. Released anywhere else
        // the click goes to an ancestor both ends share, which is no box.
        if (!swept || !(e.target instanceof Node && start.contains(e.target)))
          return;
        const swallow = (c: MouseEvent) => {
          c.preventDefault();
          c.stopPropagation();
        };
        window.addEventListener("click", swallow, {
          capture: true,
          once: true,
        });
        // The click follows its pointerup within the same input task; a
        // guard still up after that would eat the next deliberate click.
        setTimeout(
          () => window.removeEventListener("click", swallow, { capture: true }),
          0,
        );
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
      document.addEventListener("selectstart", noSelect);
      stop.current = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        document.removeEventListener("selectstart", noSelect);
        stop.current = null;
      };
    },
    [],
  );

  return { onPointerDownCapture };
}
