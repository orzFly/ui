// Firefox caps an element's height near 17.9M px, Chromium and WebKit near
// 33.5M; staying under both keeps the spacer exact wherever it fits.
export const MAX_SPACER_PX = 15_000_000;

export interface ScrollGeometry {
  rowHeight: number;
  viewportHeight: number;
  /** Whole rows the viewport shows; a fractional remainder stays empty. */
  viewportRows: number;
  spacerHeight: number;
  /** `scrollTop` maps linearly onto rows instead of one row per row height. */
  scaled: boolean;
  /** The largest top row: the last row then sits on the viewport's last whole row. */
  maxTopRow: number;
}

/** Whole rows in `viewportHeight`, at least one. */
export function rowsInViewport(viewportHeight: number, rowHeight: number) {
  // clientHeight is rounded to whole pixels, so a viewport sized to exactly
  // n rows of a fractional row height can measure up to half a pixel short.
  return Math.max(1, Math.floor((viewportHeight + 0.5) / rowHeight));
}

export function scrollGeometry(
  totalRows: number,
  rowHeight: number,
  viewportHeight: number,
): ScrollGeometry {
  const viewportRows = rowsInViewport(viewportHeight, rowHeight);
  const maxTopRow = Math.max(0, totalRows - viewportRows);
  // Scrolling the full extent walks the top row from 0 to maxTopRow, one row
  // height per row; the rows themselves stay pinned to the viewport.
  const contentHeight = maxTopRow * rowHeight + viewportHeight;
  const scaled = contentHeight > MAX_SPACER_PX;
  return {
    rowHeight,
    viewportHeight,
    viewportRows,
    spacerHeight: scaled ? MAX_SPACER_PX : contentHeight,
    scaled,
    maxTopRow,
  };
}

function maxScroll(g: ScrollGeometry): number {
  return Math.max(0, g.spacerHeight - g.viewportHeight);
}

export function topRowFromScroll(scrollTop: number, g: ScrollGeometry): number {
  const range = maxScroll(g);
  const top = Math.min(Math.max(0, scrollTop), range);
  if (!g.scaled) return clampTopRow(top / g.rowHeight, g);
  return range > 0 ? clampTopRow((top / range) * g.maxTopRow, g) : 0;
}

export function scrollFromTopRow(topRow: number, g: ScrollGeometry): number {
  const row = clampTopRow(topRow, g);
  if (!g.scaled) return row * g.rowHeight;
  return g.maxTopRow > 0 ? (row / g.maxTopRow) * maxScroll(g) : 0;
}

/** The top row is always whole: the view steps by rows, never shows half of one. */
export function clampTopRow(topRow: number, g: ScrollGeometry): number {
  return Math.min(Math.max(0, Math.round(topRow)), g.maxTopRow);
}
