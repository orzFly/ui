import { type RefObject, useLayoutEffect, useState } from "react";

export interface CellMetrics {
  /** The height of one visual row, in px. */
  rowHeight: number;
  /** The width of one terminal cell, in px. */
  cellWidth: number;
  /** The content width of the scroll container (inside its padding), in px. */
  width: number;
  /** The scroll container's visible height, in px. */
  viewportHeight: number;
}

const PROBE_TEXT = "MMMMMMMMMM";

// Until the first measurement a degenerate 0 would put every row at the top
// and wrap every line at the 20-column floor.
const DEFAULTS: CellMetrics = {
  rowHeight: 20,
  cellWidth: 8,
  width: 0,
  viewportHeight: 0,
};

function same(a: CellMetrics, b: CellMetrics) {
  return (
    a.rowHeight === b.rowHeight &&
    a.cellWidth === b.cellWidth &&
    a.width === b.width &&
    a.viewportHeight === b.viewportHeight
  );
}

/**
 * The row and cell size of the font inside `ref`'s element, read from a hidden
 * probe row, and the element's content size.
 */
export function useCellMetrics(
  ref: RefObject<HTMLElement | null>,
): CellMetrics {
  const [metrics, setMetrics] = useState(DEFAULTS);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A block, so its height is the line height rather than the glyph box.
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;white-space:pre;";
    probe.textContent = PROBE_TEXT;
    el.appendChild(probe);

    const measure = () => {
      const box = probe.getBoundingClientRect();
      const style = getComputedStyle(el);
      const padding =
        (Number.parseFloat(style.paddingLeft) || 0) +
        (Number.parseFloat(style.paddingRight) || 0);
      const next: CellMetrics = {
        rowHeight: box.height || DEFAULTS.rowHeight,
        cellWidth: box.width / PROBE_TEXT.length || DEFAULTS.cellWidth,
        width: Math.max(0, el.clientWidth - padding),
        viewportHeight: el.clientHeight,
      };
      setMetrics((prev) => (same(prev, next) ? prev : next));
    };
    measure();

    let live = true;
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    const onFonts = () => {
      if (live) measure();
    };
    fonts?.ready.then(onFonts);
    fonts?.addEventListener?.("loadingdone", onFonts);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(el);
    return () => {
      live = false;
      fonts?.removeEventListener?.("loadingdone", onFonts);
      observer?.disconnect();
      probe.remove();
    };
  }, [ref]);

  return metrics;
}
