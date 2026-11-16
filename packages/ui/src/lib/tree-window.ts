/** The part of a tree on screen, in px from the tree's top edge. `top` is negative while the tree starts below the viewport's top. */
export interface TreeView {
  top: number;
  height: number;
}

/** Rows mounted beyond each edge of the viewport. */
export const TREE_OVERSCAN = 10;

/** Rows mounted before the row height is known: on the server, in the first frame, with no layout. */
export const TREE_INITIAL_ROWS = 40;

/** A tree with more visible rows than this virtualizes under `virtualize="auto"`. */
export const TREE_VIRTUALIZE_ABOVE = 200;

/** First and one-past-last row index on screen, `overscan` rows wider each way, clamped to `[0, count]`. */
export function windowRange(
  count: number,
  rowHeight: number,
  view: TreeView,
  overscan: number = TREE_OVERSCAN,
): { start: number; end: number } {
  const clamp = (i: number) => Math.min(count, Math.max(0, i));
  const start = clamp(Math.floor(view.top / rowHeight) - overscan);
  const end = clamp(Math.ceil((view.top + view.height) / rowHeight) + overscan);
  return { start, end: Math.max(start, end) };
}

/** What to mount, in row order: runs of rows, and the gaps between them as row counts. */
export type TreeSegment =
  | { kind: "rows"; start: number; end: number }
  | { kind: "gap"; rows: number };

/**
 * The rows in `range` together with every index in `keep` (out-of-range indexes ignored),
 * as runs in order with a gap before, between and after them. Empty gaps are left out.
 */
export function mountedSegments(
  count: number,
  range: { start: number; end: number },
  keep: Iterable<number>,
): TreeSegment[] {
  const runs: { start: number; end: number }[] = [];
  if (range.end > range.start) runs.push({ ...range });
  for (const i of keep) {
    if (!Number.isInteger(i) || i < 0 || i >= count) continue;
    runs.push({ start: i, end: i + 1 });
  }
  runs.sort((a, b) => a.start - b.start);

  const segments: TreeSegment[] = [];
  let at = 0;
  let open: { start: number; end: number } | undefined;
  const close = () => {
    if (!open) return;
    segments.push({ kind: "rows", ...open });
    at = open.end;
    open = undefined;
  };
  for (const run of runs) {
    // Touching runs make one: a kept row beside the window is no gap.
    if (open && run.start <= open.end) {
      open.end = Math.max(open.end, run.end);
      continue;
    }
    close();
    if (run.start > at) segments.push({ kind: "gap", rows: run.start - at });
    open = { ...run };
  }
  close();
  if (count > at) segments.push({ kind: "gap", rows: count - at });
  return segments;
}

/** The rows the pins are worked out from: the fields of `TreeRow` / `TreeLoadingRow` they read. */
export interface TreePinSource {
  kind: "item" | "loading";
  level: number;
  expanded?: boolean;
}

/** A branch pinned at the top: its row index, and its top within the pins in px (below 0 while pushed out). */
export interface TreePin {
  index: number;
  top: number;
}

/** Index of the last row inside the subtree of the row at `index` (itself for a leaf or a closed branch). */
export function subtreeEnd(
  rows: readonly TreePinSource[],
  index: number,
): number {
  const level = rows[index]?.level ?? 0;
  let end = index;
  while (end + 1 < rows.length && (rows[end + 1]?.level ?? 0) > level) end++;
  return end;
}

/** How many pins fit: half the viewport, whole rows. */
export function maxPins(rowHeight: number, viewHeight: number): number {
  if (!(rowHeight > 0) || !(viewHeight > 0)) return 0;
  return Math.floor(viewHeight / 2 / rowHeight);
}

/**
 * The pins for `view`, outermost first, at most `maxPins`. Pin k is the branch at level k + 1
 * whose subtree holds the row in the k-th row slot below the viewport's top, as long as that
 * branch is open and its parent is pin k − 1; it slides up out of its slot while the last row
 * of its subtree passes under it.
 */
export function pinnedRows(
  rows: readonly TreePinSource[],
  rowHeight: number,
  view: TreeView,
  maxPins: number,
): TreePin[] {
  const pins: TreePin[] = [];
  if (view.top <= 0 || !(rowHeight > 0)) return pins;
  let parentEnd = rows.length - 1;
  let parentIndex = -1;
  for (let k = 0; k < maxPins; k++) {
    const slot = Math.floor((view.top + k * rowHeight) / rowHeight);
    if (slot >= rows.length || slot > parentEnd) break;
    // The slot's row, or its ancestor at this level.
    let index = slot;
    while (index > parentIndex && (rows[index]?.level ?? 0) > k + 1) index--;
    const row = rows[index];
    if (index <= parentIndex || !row || row.level !== k + 1) break;
    if (row.kind !== "item" || !row.expanded) break;
    const end = subtreeEnd(rows, index);
    const top = Math.min(
      k * rowHeight,
      (end + 1) * rowHeight - view.top - rowHeight,
    );
    if (top + rowHeight <= 0) break;
    pins.push({ index, top });
    parentIndex = index;
    parentEnd = end;
  }
  return pins;
}

/**
 * The view top that brings the row at `index` into sight below `inset` px of pins, or
 * `undefined` when `"nearest"` finds it already in sight.
 */
export function revealTop(
  index: number,
  rowHeight: number,
  view: TreeView,
  inset: number,
  align: "nearest" | "start" | "center",
): number | undefined {
  const y = index * rowHeight;
  if (align === "start") return y - inset;
  if (align === "center")
    return y - inset - (view.height - inset - rowHeight) / 2;
  if (y < view.top + inset) return y - inset;
  if (y + rowHeight > view.top + view.height)
    return y + rowHeight - view.height;
  return undefined;
}
