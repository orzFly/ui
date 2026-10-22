// Firefox caps an element's height near 17.9M px, Chromium and WebKit near
// 33.5M; staying under both keeps the spacer exact wherever it fits.
export const MAX_SPACER_PX = 15_000_000;

export interface ScrollGeometry {
  rowHeight: number;
  viewportHeight: number;
  spacerHeight: number;
  /** `scrollTop` maps linearly onto rows instead of one pixel per pixel. */
  scaled: boolean;
  /** The largest top row: the last row then sits at the bottom of the viewport. */
  maxTopRow: number;
}

export function scrollGeometry(
  totalRows: number,
  rowHeight: number,
  viewportHeight: number,
): ScrollGeometry {
  const contentHeight = totalRows * rowHeight;
  const maxTopRow = Math.max(0, totalRows - viewportHeight / rowHeight);
  const scaled = contentHeight > MAX_SPACER_PX;
  return {
    rowHeight,
    viewportHeight,
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
  if (!g.scaled) return Math.min(top / g.rowHeight, g.maxTopRow);
  return range > 0 ? (top / range) * g.maxTopRow : 0;
}

export function scrollFromTopRow(topRow: number, g: ScrollGeometry): number {
  const row = Math.min(Math.max(0, topRow), g.maxTopRow);
  if (!g.scaled) return row * g.rowHeight;
  return g.maxTopRow > 0 ? (row / g.maxTopRow) * maxScroll(g) : 0;
}

export function clampTopRow(topRow: number, g: ScrollGeometry): number {
  return Math.min(Math.max(0, topRow), g.maxTopRow);
}
