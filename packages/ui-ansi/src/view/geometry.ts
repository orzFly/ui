import { cellWidth as codePointCells } from "@orz/ui/lib/cell-width";
import type { AnsiLine } from "../parse/types.ts";

/** Above this many visual rows the view mounts only the visible ones. */
export const VIRTUALIZE_ABOVE = 5000;

const MIN_COLUMNS = 20;

// U+1100 is the first wide code point, and supplementary code points start
// with a surrogate, so text without these code units has no wide character.
const MAYBE_WIDE = /[\u1100-\uffff]/;

/** The wrap column count for a content width, at least 20. */
export function columnsFor(width: number, cellWidth: number): number {
  const cols = Math.floor(width / cellWidth);
  return Number.isFinite(cols) && cols > MIN_COLUMNS ? cols : MIN_COLUMNS;
}

/**
 * Rows a line of `cells` takes when every cut can fall on any cell. A wide
 * character pushed past a cut can add rows; {@link splitRows} is exact.
 */
export function rowsForLine(cells: number, cols: number): number {
  return cells <= cols ? 1 : Math.ceil(cells / cols);
}

function walkRows(
  text: string,
  cols: number,
  onCut: (from: number, to: number, fromCell: number) => void,
): void {
  let rowStart = 0;
  let rowFromCell = 0;
  let rowCells = 0;
  let i = 0;
  while (i < text.length) {
    const cp = text.codePointAt(i) as number;
    const w = codePointCells(cp);
    if (w > 0 && rowCells > 0 && rowCells + w > cols) {
      onCut(rowStart, i, rowFromCell);
      rowStart = i;
      rowFromCell += rowCells;
      rowCells = 0;
    }
    rowCells += w;
    i += cp > 0xffff ? 2 : 1;
  }
  onCut(rowStart, text.length, rowFromCell);
}

/**
 * Each visual row of `line` wrapped at `cols`, as `[fromOffset, toOffset,
 * fromCell]` with UTF-16 offsets into `line.text`. Zero-width code points stay
 * with the character before them; a wide character that would straddle the cut
 * starts the next row.
 */
export function splitRows(
  line: Pick<AnsiLine, "text">,
  cols: number,
): Array<[number, number, number]> {
  const rows: Array<[number, number, number]> = [];
  walkRows(line.text, cols, (from, to, fromCell) =>
    rows.push([from, to, fromCell]),
  );
  return rows;
}

function exactRows(text: string, cols: number): number {
  let rows = 0;
  walkRows(text, cols, () => rows++);
  return rows;
}

/**
 * The first visual row of each line, then the total row count at index
 * `lines.length`. `cols` of `null` means no wrap: one row per line. `prev`, an
 * index built with the same `cols` over a prefix of `lines`, is extended
 * rather than rebuilt. With `shown`, the index runs over `lines[shown[i]]`
 * only, and `prev` must cover a prefix of `shown`.
 */
export function buildRowIndex(
  lines: readonly Pick<AnsiLine, "text" | "cells">[],
  cols: number | null,
  prev?: Uint32Array,
  shown?: Uint32Array | null,
): Uint32Array {
  const n = shown ? shown.length : lines.length;
  let start = 0;
  let index: Uint32Array;
  if (prev && prev.length > 0 && prev.length <= n + 1) {
    start = prev.length - 1;
    // A streamed log extends its index on every publish; spare capacity
    // keeps that from copying the whole index each time.
    if (prev.byteOffset === 0 && prev.buffer.byteLength >= (n + 1) * 4) {
      index = new Uint32Array(prev.buffer, 0, n + 1);
    } else {
      const grown = new Uint32Array(Math.max(n + 1, 2 * prev.length));
      grown.set(prev);
      index = grown.subarray(0, n + 1);
    }
  } else {
    index = new Uint32Array(n + 1);
  }
  if (cols === null) {
    for (let i = start; i <= n; i++) index[i] = i;
    return index;
  }
  let row = index[start];
  for (let i = start; i < n; i++) {
    index[i] = row;
    const line = lines[shown ? shown[i] : i];
    const cells = line.cells;
    if (cells <= cols) row += 1;
    // Only a wide character can leave a cell unused at a cut, so the ceil
    // formula is exact without one; the code-point walk is kept for the rare
    // wrapped line that may hold one, which keeps a million lines in a few ms.
    else if (!MAYBE_WIDE.test(line.text)) row += Math.ceil(cells / cols);
    else row += exactRows(line.text, cols);
  }
  index[n] = row;
  return index;
}

/** The line holding visual `row`, clamped to the index's lines. */
export function lineAtRow(index: Uint32Array, row: number): number {
  const last = index.length - 2;
  if (last < 0) return 0;
  let lo = 0;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (index[mid] <= row) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The line id at `pos` in a shown list, or `pos` itself when all are shown. */
export function lineIdAt(shown: Uint32Array | null, pos: number): number {
  return shown ? shown[pos] : pos;
}
