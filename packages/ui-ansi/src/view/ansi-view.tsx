import { Button } from "@orz/ui/components/button";
import { cellWidth as codePointCells } from "@orz/ui/lib/cell-width";
import { copyToClipboard } from "@orz/ui/lib/clipboard";
import { rowsInViewport } from "@orz/ui/lib/scroll-map";
import { cn } from "@orz/ui/lib/utils";
import { CopyIcon, DownloadIcon, WrapTextIcon } from "lucide-react";
import {
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  detectLevel,
  LEVEL_INHERITED,
  type LevelDetector,
  type LevelMatch,
} from "../parse/levels.ts";
import { stripAnsi } from "../parse/parser.ts";
import type { AnsiLine } from "../parse/types.ts";
import {
  buildRowIndex,
  columnsFor,
  lineAtRow,
  lineIdAt,
  splitRows,
  VIRTUALIZE_ABOVE,
} from "./geometry.ts";
import { useCellMetrics } from "./metrics.ts";
import { AnsiRow, GUTTER_TEXT_GAP, gutterCells, type RowMark } from "./row.tsx";
import { createStyleCache } from "./run-style.ts";
import { appendShownLines, buildShownLines, levelMask } from "./shown-lines.ts";
import { LevelChips, type LevelKey, SearchBox } from "./toolbar.tsx";
import { useAnsiLines } from "./use-ansi-lines.ts";
import { useSearch } from "./use-search.ts";
import { VirtualRows, type VirtualRowsHandle } from "./virtual-rows.tsx";

export interface AnsiViewProps {
  text: string;
  /** "pane": the terminal pane. "file": header, line numbers, Download. */
  chrome: "pane" | "file";
  /** Shown in the header with chrome="file". */
  filename?: string;
  /** Download link in the header. */
  downloadUrl?: string;
  /** Bold text in palette colours 0–7 is drawn in 8–15. Default false. */
  boldIsBright?: boolean;
  /** Initial wrap state; the Wrap button toggles it. Default false. */
  wrap?: boolean;
  /** How tall the view may grow before it scrolls. Default: grows to fit. */
  maxHeight?: string;
  /**
   * Detects each line's log level, colours rows by it and, with
   * chrome="file", offers a filter by level. `true` uses `detectLevel`; a
   * function replaces it, and should keep its identity across renders, since
   * a new one parses the text again. Default false.
   */
  levels?: boolean | LevelDetector;
  className?: string;
}

/** A virtualised view needs a bounded height even when none was given. */
const VIRTUAL_HEIGHT = "32rem";

const CONTENT_PADDING = 8;

/**
 * The line between the gutter and the text, as a background of the rows'
 * container: it spans the padding too, and adds no node a selection could
 * land in.
 */
function gutterRule(gutterCells: number): CSSProperties | undefined {
  if (gutterCells === 0) return undefined;
  return {
    backgroundImage:
      "linear-gradient(var(--color-border), var(--color-border))",
    backgroundRepeat: "no-repeat",
    backgroundSize: "1px 100%",
    backgroundPosition: `calc(${gutterCells - GUTTER_TEXT_GAP}ch - 1px) 0`,
  };
}

type RowRange = readonly [from: number, to: number, fromCell: number];

function lineCountLabel(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "line" : "lines"}`;
}

/** The first position in `shown` holding line `id` or a later one; `id` itself with every line shown. */
function positionOf(shown: Uint32Array | null, id: number): number {
  if (!shown) return id;
  let lo = 0;
  let hi = shown.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (shown[mid] < id) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The first of `count` match triples on line `id` or a later one. */
function firstMatchFrom(matches: Uint32Array, count: number, id: number) {
  let lo = 0;
  let hi = count;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (matches[3 * mid] < id) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Cells taken by `text` before UTF-16 offset `to`. */
function cellsBefore(text: string, to: number): number {
  let cells = 0;
  for (let i = 0; i < to; ) {
    const cp = text.codePointAt(i) as number;
    cells += codePointCells(cp);
    i += cp > 0xffff ? 2 : 1;
  }
  return cells;
}

/**
 * Each shown list made by appending to another, mapped to that one: their
 * common positions hold the same lines, so a row index over the older one
 * can be extended.
 */
const grownFrom = new WeakMap<Uint32Array, Uint32Array>();

function grow(prev: Uint32Array | null, next: Uint32Array | null) {
  if (prev && next && next !== prev) grownFrom.set(next, prev);
  return next;
}

function extendsShown(prev: Uint32Array | null, next: Uint32Array | null) {
  return prev === next || (next !== null && grownFrom.get(next) === prev);
}

/** A shown list, and what it was built over, so the next can extend it. */
interface ShownState<T extends Uint32Array | null> {
  lines: readonly AnsiLine[];
  mask: number;
  /** Lines `[0, upTo)` have been considered. */
  upTo: number;
  matchLines: Uint8Array | null;
  ids: T;
}

const NO_LEVELS: ReadonlySet<LevelKey> = new Set();

/**
 * The UTF-16 offset of the DOM point (`node`, `offset`) within the text of
 * `root`, or null when the point is not inside `root`.
 */
function textOffset(root: Node, node: Node, offset: number): number | null {
  let total = 0;
  const visit = (n: Node): boolean => {
    if (n === node) {
      if (n.nodeType === Node.TEXT_NODE) {
        total += offset;
      } else {
        const children = n.childNodes;
        for (let i = 0; i < offset && i < children.length; i++) {
          total += children[i].textContent?.length ?? 0;
        }
      }
      return true;
    }
    if (n.nodeType === Node.TEXT_NODE) {
      total += (n as Text).length;
      return false;
    }
    for (const child of n.childNodes) if (visit(child)) return true;
    return false;
  };
  return visit(root) ? total : null;
}

/** A place in the model: a line and an offset in its text. */
interface ModelPoint {
  line: number;
  at: number;
}

const isBefore = (a: ModelPoint, b: ModelPoint) =>
  a.line < b.line || (a.line === b.line && a.at < b.at);

/** Where a DOM point inside `row` falls in the model. */
function rowPoint(row: Element, node: Node, offset: number): ModelPoint | null {
  const line = Number(row.getAttribute("data-line"));
  const from = Number(row.getAttribute("data-from"));
  const text = row.querySelector("[data-text]");
  if (!text || Number.isNaN(line) || Number.isNaN(from)) return null;
  let within = textOffset(text, node, offset);
  if (within === null) {
    // On the row itself or in its gutter: before or after the text.
    const textIndex = Array.prototype.indexOf.call(row.childNodes, text);
    within =
      node === row && offset > textIndex ? (text.textContent?.length ?? 0) : 0;
  }
  return { line, at: from + within };
}

/**
 * Where a selection endpoint falls in the model, or null when it is outside
 * `view`. `kept` is where the same endpoint was last seen.
 */
function selectionPoint(
  view: Element,
  node: Node,
  offset: number,
  kept: ModelPoint | null,
): ModelPoint | null {
  // Browsers move an endpoint whose row unmounts to the row's parent, but it
  // may still be caught detached.
  if (!node.isConnected) return kept;
  if (!view.contains(node)) return null;
  const el = node instanceof Element ? node : node.parentElement;
  const row = el?.closest("[data-line]");
  if (row && view.contains(row)) return rowPoint(row, node, offset);
  // Between rows, e.g. a drag past the last one: the start of the next row,
  // or the end of the last.
  const rows = view.querySelectorAll("[data-line]");
  if (rows.length === 0) return null;
  const probe = document.createRange();
  probe.setStart(node, offset);
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (probe.comparePoint(rows[mid], 0) > 0) hi = mid;
    else lo = mid + 1;
  }
  if (lo < rows.length) {
    const next = rows[lo];
    const point = rowPoint(next, next, 0);
    // Before the first row of a virtual window, the endpoint stands in for a
    // row scrolled out above it, where it was last seen.
    if (point && lo === 0 && kept && isBefore(kept, point)) return kept;
    return point;
  }
  const last = rows[rows.length - 1];
  const point = rowPoint(last, last, last.childNodes.length);
  if (point && kept && isBefore(point, kept)) return kept;
  return point;
}

/** The rows of the index, and what they were built from. */
interface Layout {
  lines: readonly AnsiLine[];
  cols: number | null;
  /** The line ids the index runs over; null for every line. */
  shown: Uint32Array | null;
  index: Uint32Array;
  /**
   * The line that was at the top when the filter changed into this layout,
   * to be kept there once it is drawn.
   */
  anchor?: number;
}

function rangesOf(line: AnsiLine, cols: number | null): readonly RowRange[] {
  return cols === null || line.cells <= cols
    ? [[0, line.text.length, 0]]
    : splitRows(line, cols);
}

/**
 * The row of layout `to` that holds the text at `row` of layout `from`. A line
 * the filter now hides gives way to the next shown line.
 */
function carryRow(row: number, from: Layout, to: Layout): number {
  if (from.lines !== to.lines) return row;
  if (from.cols === to.cols && from.shown === to.shown) return row;
  const pos = lineAtRow(from.index, row);
  if (pos >= from.index.length - 1) return row;
  const id = lineIdAt(from.shown, pos);
  const toPos = from.shown === to.shown ? pos : positionOf(to.shown, id);
  const end = to.index.length - 1;
  if (toPos >= end) return to.index[end];
  if (lineIdAt(to.shown, toPos) !== id) return to.index[toPos];
  const within = row - from.index[pos];
  if (from.cols === to.cols) return to.index[toPos] + within;
  const line = to.lines[id];
  const at = rangesOf(line, from.cols)[within]?.[0] ?? 0;
  const ranges = rangesOf(line, to.cols);
  let k = 0;
  while (k + 1 < ranges.length && ranges[k + 1][0] <= at) k++;
  return to.index[toPos] + k;
}

interface Nav {
  /** The current match, or -1. */
  index: number;
  /**
   * The scan `index` counts in. A scan that starts over is a new search, whose
   * first match the view goes to; until then there is no current match.
   */
  generation: number;
  lines: readonly AnsiLine[];
}

interface SelectionPoints {
  lines: readonly AnsiLine[];
  start: ModelPoint | null;
  end: ModelPoint | null;
}

/** Text with ANSI escapes drawn in the theme's terminal colours. */
export function AnsiView({
  text,
  chrome,
  filename,
  downloadUrl,
  boldIsBright = false,
  wrap: initialWrap = false,
  maxHeight,
  levels = false,
  className,
}: AnsiViewProps) {
  const detector = levels === true ? detectLevel : levels || false;
  const parse = useAnsiLines(text, detector);
  const { lines, styles, maxCells, done } = parse;
  const levelCodes = parse.levels;
  const [wrap, setWrap] = useState(initialWrap);
  const scrollRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const virtualRef = useRef<VirtualRowsHandle>(null);
  const { rowHeight, cellWidth, width, viewportHeight } =
    useCellMetrics(scrollRef);
  // Fences are short and keep the browser's find-in-page.
  const searchable = chrome === "file";

  const [hidden, setHidden] = useState<ReadonlySet<LevelKey>>(NO_LEVELS);
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const [onlyMatching, setOnlyMatching] = useState(false);
  // A pane has no chips to undo a filter set before a switch to it.
  const mask = levelMask(levelCodes && searchable ? hidden : NO_LEVELS);

  // `lines` grows in place while a large text streams in; the shown lists
  // and the row index extend the last ones rather than start over.
  const levelShownRef = useRef<ShownState<Uint32Array | null> | null>(null);
  const levelShown = useMemo(() => {
    const upTo = levelCodes ? levelCodes.length : lines.length;
    const last = levelShownRef.current;
    const ids =
      last && last.lines === lines && last.mask === mask && last.upTo <= upTo
        ? last.upTo === upTo
          ? last.ids
          : grow(
              last.ids,
              appendShownLines(
                last.ids,
                last.upTo,
                upTo,
                levelCodes,
                mask,
                null,
              ),
            )
        : buildShownLines(upTo, levelCodes, mask, null);
    levelShownRef.current = { lines, mask, upTo, matchLines: null, ids };
    return ids;
  }, [lines, levelCodes, mask]);

  // "Only matching lines" filters after the search, which reads the level
  // filter's list: the search must not depend on its own results.
  const search = useSearch({
    query: searchable ? query : "",
    caseSensitive,
    regex,
    lines,
    count: lines.length,
    done,
    shown: levelShown,
  });
  const matchFilter =
    searchable && onlyMatching && query !== "" && search.error === null;
  const matchShownRef = useRef<ShownState<Uint32Array> | null>(null);
  const shown = useMemo(() => {
    if (!matchFilter) return levelShown;
    const { matches, count, matchLines } = search;
    // A scan walks the lines in order, so no match will come before its last.
    const upTo = count > 0 ? matches[3 * (count - 1)] + 1 : 0;
    const last = matchShownRef.current;
    const ids =
      last &&
      last.lines === lines &&
      last.mask === mask &&
      last.matchLines === matchLines &&
      last.upTo <= upTo
        ? last.upTo === upTo
          ? last.ids
          : (grow(
              last.ids,
              appendShownLines(
                last.ids,
                last.upTo,
                upTo,
                levelCodes,
                mask,
                matchLines,
              ),
            ) as Uint32Array)
        : (appendShownLines(
            null,
            0,
            upTo,
            levelCodes,
            mask,
            matchLines,
          ) as Uint32Array);
    matchShownRef.current = { lines, mask, upTo, matchLines, ids };
    return ids;
  }, [matchFilter, levelShown, search, lines, levelCodes, mask]);

  const gutterDigits =
    chrome === "file" ? String(Math.max(1, lines.length)).length : 0;
  const gutterWidth = gutterCells(gutterDigits) * cellWidth;
  const cols = wrap ? columnsFor(width - gutterWidth, cellWidth) : null;

  const topRowNow = (): number => {
    const handle = virtualRef.current;
    if (handle) return handle.topRow();
    const el = scrollRef.current;
    if (!el) return 0;
    return Math.max(
      0,
      Math.round((el.scrollTop - CONTENT_PADDING) / rowHeight),
    );
  };
  const topRowNowRef = useRef(topRowNow);
  topRowNowRef.current = topRowNow;

  const lastLayout = useRef<Layout | null>(null);
  const layout = useMemo((): Layout => {
    const last = lastLayout.current;
    const sameLines = last !== null && last.lines === parse.lines;
    const extended = sameLines && extendsShown(last.shown, shown);
    const prev = extended && last.cols === cols ? last.index : undefined;
    const next: Layout = {
      lines: parse.lines,
      cols,
      shown,
      index: buildRowIndex(parse.lines, cols, prev, shown),
    };
    // Read before the new rows are committed, which may clamp scrollTop. A
    // pending anchor wins: the rows drawn meanwhile did not reach it.
    if (sameLines && !extended) {
      next.anchor =
        last.anchor ??
        (last.index.length > 1
          ? lineIdAt(last.shown, lineAtRow(last.index, topRowNowRef.current()))
          : undefined);
    } else if (extended) {
      // Still pending when a render was not committed, or StrictMode built
      // this layout twice.
      next.anchor = last.anchor;
    }
    lastLayout.current = next;
    return next;
  }, [parse, cols, shown]);
  const { index } = layout;
  const lineCount = index.length - 1;
  const totalRows = index[lineCount];
  // While a large text streams in, its rows so far undercount it; judged by
  // them alone, the first slices would mount thousands of rows only to drop
  // them a tick later.
  // "Only matching lines" refills from nothing as a scan restarts: a list
  // that was virtual stays so until the scan is done.
  const wasVirtual = useRef(false);
  const virtual =
    (parse.parsed > 0 ? totalRows / parse.parsed : totalRows) >
      VIRTUALIZE_ABOVE ||
    (wasVirtual.current && matchFilter && search.scanning);
  wasVirtual.current = virtual;

  const rowsOfLine = useMemo(() => {
    const cache = new WeakMap<AnsiLine, readonly RowRange[]>();
    return (line: AnsiLine): readonly RowRange[] => {
      let rows = cache.get(line);
      if (!rows) {
        rows = rangesOf(line, cols);
        if (rows.length > 1) cache.set(line, rows);
      }
      return rows;
    };
  }, [cols]);

  const styleCache = useMemo(() => createStyleCache(styles), [styles]);
  const styleOf = useCallback(
    (id: number) => styleCache(id, boldIsBright),
    [styleCache, boldIsBright],
  );

  const levelMatchOf = useMemo(() => {
    const cache = new WeakMap<AnsiLine, LevelMatch | null>();
    return (line: AnsiLine, code: number): LevelMatch | null => {
      // An inherited level has no word of its own on the line.
      if (!detector || code === 0 || code & LEVEL_INHERITED) return null;
      let match = cache.get(line);
      if (match === undefined) {
        try {
          match = detector(line.text);
        } catch {
          // The level tracker has already reported it.
          match = null;
        }
        cache.set(line, match);
      }
      return match;
    };
  }, [detector]);

  const [nav, setNav] = useState<Nav>(() => ({
    index: -1,
    generation: search.generation,
    lines,
  }));
  if (nav.lines !== lines) {
    setNav({ index: -1, generation: search.generation, lines });
  }
  const current =
    nav.lines === lines &&
    nav.generation === search.generation &&
    nav.index < search.count
      ? nav.index
      : -1;
  const resetNav = () =>
    setNav({ index: -1, generation: search.generation, lines });

  // A row is memoised on its marks, so each line keeps its array until its
  // matches or the current match change. Matches only append within one
  // buffer; a new buffer is a new scan, or a grown one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new buffer starts a new cache
  const markCache = useMemo(
    () => ({
      byLine: new Map<number, readonly RowMark[] | undefined>(),
      current: -1,
    }),
    [search.matches.buffer],
  );
  if (markCache.current !== current) {
    for (const k of [markCache.current, current]) {
      if (k >= 0) markCache.byLine.delete(search.matches[3 * k]);
    }
    markCache.current = current;
  }
  const marksOf = (id: number): readonly RowMark[] | undefined => {
    const { matches, count } = search;
    if (count === 0) return undefined;
    const { byLine } = markCache;
    if (byLine.has(id)) return byLine.get(id);
    let marks: RowMark[] | undefined;
    for (
      let k = firstMatchFrom(matches, count, id);
      k < count && matches[3 * k] === id;
      k++
    ) {
      marks ??= [];
      marks.push([matches[3 * k + 1], matches[3 * k + 2], k === current]);
    }
    // A scan finishes a line before it moves on, so lines up to the last
    // match's are final; later ones may still be found.
    if (id <= matches[3 * (count - 1)]) byLine.set(id, marks);
    return marks;
  };

  const renderRow = (pos: number, range: RowRange | undefined) => {
    const id = lineIdAt(shown, pos);
    const line = lines[id];
    const [from, to] = range ?? [line.text.length, line.text.length];
    const code = levelCodes ? levelCodes[id] : 0;
    return (
      <AnsiRow
        key={`${id}:${from}`}
        lineIndex={id}
        line={line}
        from={from}
        to={to}
        styles={styles}
        styleOf={styleOf}
        gutterDigits={gutterDigits}
        level={code}
        levelMatch={levelMatchOf(line, code)}
        marks={marksOf(id)}
        // The first shown line has no previous one to be apart from.
        gap={shown !== null && pos > 0 && shown[pos - 1] + 1 !== id}
      />
    );
  };

  const renderVirtualRow = (row: number) => {
    const pos = lineAtRow(index, row);
    const ranges = rowsOfLine(lines[lineIdAt(shown, pos)]);
    return renderRow(pos, ranges[row - index[pos]]);
  };

  const contentWidth = wrap ? undefined : gutterWidth + maxCells * cellWidth;

  let body: ReactNode;
  if (virtual) {
    body = (
      <VirtualRows
        scrollRef={scrollRef}
        totalRows={totalRows}
        rowHeight={rowHeight}
        viewportHeight={viewportHeight}
        width={contentWidth}
        renderRow={renderVirtualRow}
        layout={layout}
        carryRow={carryRow}
        padding={CONTENT_PADDING}
        style={gutterRule(gutterCells(gutterDigits))}
        handle={virtualRef}
      />
    );
  } else {
    const rows: ReactNode[] = [];
    for (let pos = 0; pos < lineCount; pos++) {
      for (const range of rowsOfLine(lines[lineIdAt(shown, pos)])) {
        rows.push(renderRow(pos, range));
      }
    }
    body = (
      <div
        className="min-w-full"
        style={{
          ...gutterRule(gutterCells(gutterDigits)),
          width: contentWidth,
          paddingBlock: CONTENT_PADDING,
        }}
      >
        {rows}
      </div>
    );
  }

  // A virtual view unmounts the rows a selection started in as it scrolls,
  // so where each endpoint was last seen is kept.
  const kept = useRef<SelectionPoints | null>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const selectionPoints = useCallback(
    (view: Element, range: Range): SelectionPoints => {
      const current = linesRef.current;
      const last = kept.current?.lines === current ? kept.current : null;
      return {
        lines: current,
        start: selectionPoint(
          view,
          range.startContainer,
          range.startOffset,
          last?.start ?? null,
        ),
        end: selectionPoint(
          view,
          range.endContainer,
          range.endOffset,
          last?.end ?? null,
        ),
      };
    },
    [],
  );
  useEffect(() => {
    const onChange = () => {
      const view = scrollRef.current;
      const selection = document.getSelection();
      const range =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      kept.current =
        view &&
        range &&
        (view.contains(range.startContainer) ||
          view.contains(range.endContainer))
          ? selectionPoints(view, range)
          : null;
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, [selectionPoints]);

  const onCopy = (event: ClipboardEvent<HTMLElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;
    const { start, end } = selectionPoints(event.currentTarget, range);
    if (!start || !end) return;
    let copied: string;
    if (start.line === end.line) {
      copied = lines[start.line].text.slice(start.at, end.at);
    } else {
      const parts = [lines[start.line].text.slice(start.at)];
      // Lines the filter hides are not pasted.
      for (
        let pos = positionOf(shown, start.line + 1);
        pos < lineCount;
        pos++
      ) {
        const id = lineIdAt(shown, pos);
        if (id >= end.line) break;
        parts.push(lines[id].text);
      }
      parts.push(lines[end.line].text.slice(0, end.at));
      copied = parts.join("\n");
    }
    event.clipboardData.setData("text/plain", copied);
    event.preventDefault();
  };

  const copyAll = () => {
    if (shown) {
      const parts = new Array<string>(shown.length);
      for (let pos = 0; pos < shown.length; pos++) {
        parts[pos] = lines[shown[pos]].text;
      }
      void copyToClipboard(parts.join("\n"), "Copied output");
      return;
    }
    // Once parsed, the lines already are the stripped text; parsing a large
    // log again would block for as long as the first parse took.
    const plain = done
      ? lines.map((line) => line.text).join("\n")
      : stripAnsi(text);
    void copyToClipboard(plain, "Copied output");
  };

  const scrollToRow = (row: number, align: "top" | "center") => {
    const handle = virtualRef.current;
    if (handle) {
      handle.scrollToRow(row, align);
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    const y = CONTENT_PADDING + row * rowHeight;
    el.scrollTop =
      align === "top"
        ? row === 0
          ? 0
          : y
        : Math.max(0, y - (viewportHeight - rowHeight) / 2);
  };

  const topLineNow = () =>
    lineCount > 0 ? lineIdAt(shown, lineAtRow(index, topRowNow())) : 0;

  /** Makes match `k` current and scrolls to it; `reveal` leaves a visible one where it is. */
  const goTo = (k: number, reveal: boolean) => {
    const { matches } = search;
    setNav({ index: k, generation: search.generation, lines });
    const id = matches[3 * k];
    const pos = positionOf(shown, id);
    const line = lines[id];
    if (!line || pos >= lineCount || lineIdAt(shown, pos) !== id) return;
    const from = matches[3 * k + 1];
    let row = index[pos];
    if (cols !== null) {
      const ranges = rowsOfLine(line);
      let r = 0;
      while (r + 1 < ranges.length && ranges[r + 1][0] <= from) r++;
      row += r;
    }
    const top = topRowNow();
    if (
      !reveal ||
      row < top ||
      row >= top + rowsInViewport(viewportHeight, rowHeight)
    ) {
      scrollToRow(row, "center");
    }
    const el = scrollRef.current;
    if (!el || cols !== null) return;
    const before = cellsBefore(line.text, from);
    const start = gutterWidth + before * cellWidth;
    const end =
      start + (cellsBefore(line.text, matches[3 * k + 2]) - before) * cellWidth;
    if (start >= el.scrollLeft && end <= el.scrollLeft + width) return;
    el.scrollLeft = end <= width ? 0 : Math.max(0, (start + end - width) / 2);
  };

  const stepMatch = (back: boolean) => {
    const { matches, count } = search;
    if (count === 0) return;
    let k = current;
    if (k < 0) {
      k = firstMatchFrom(matches, count, topLineNow());
      if (back) k--;
    } else {
      k += back ? -1 : 1;
    }
    goTo((k + count) % count, false);
  };

  // More lines may still join the shown list, past those it holds.
  const growing = !done || (matchFilter && search.scanning);

  // The filter changed: keep the line that was at the top, or the next one
  // still shown. A list refilling from nothing waits until it reaches that
  // line, or can grow no more.
  useLayoutEffect(() => {
    const { anchor, index: rows, shown: ids } = layout;
    if (anchor === undefined) return;
    const end = rows.length - 1;
    if (end === 0) return;
    if (growing && lineIdAt(ids, end - 1) < anchor) return;
    layout.anchor = undefined;
    const pos = Math.min(positionOf(ids, anchor), end - 1);
    if (lineAtRow(rows, topRowNowRef.current()) === pos) return;
    scrollToRow(rows[pos], "top");
  });

  // A new search goes to its first match at or below the top line, so typing
  // does not jump back to the start of the log.
  useLayoutEffect(() => {
    if (nav.generation === search.generation || search.count === 0) return;
    // A pending anchor is where the reader is; the scroll has yet to follow.
    const k = firstMatchFrom(
      search.matches,
      search.count,
      layout.anchor ?? topLineNow(),
    );
    // The scan has not reached the top line yet.
    if (k === search.count && search.scanning) return;
    goTo(k < search.count ? k : 0, true);
  });

  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    if (event.key.toLowerCase() !== "f") return;
    const input = searchRef.current;
    if (!input) return;
    event.preventDefault();
    input.focus();
    input.select();
  };

  const tools = (
    <>
      <Button
        size="xs"
        variant="ghost"
        aria-label="Wrap lines"
        title="Wrap lines"
        aria-pressed={wrap}
        className="aria-pressed:bg-muted aria-pressed:text-foreground"
        onClick={() => setWrap((on) => !on)}
      >
        <WrapTextIcon />
      </Button>
      <Button
        size="xs"
        variant="ghost"
        aria-label="Copy output"
        title="Copy output"
        onClick={copyAll}
      >
        <CopyIcon />
      </Button>
    </>
  );

  const scroller = (
    <section
      ref={scrollRef}
      aria-label={filename ?? "Terminal output"}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region takes focus so the keyboard can scroll it
      tabIndex={0}
      onCopy={onCopy}
      className="relative min-h-0 flex-auto overflow-auto px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
      style={
        virtual
          ? { height: maxHeight ?? VIRTUAL_HEIGHT }
          : maxHeight === undefined
            ? undefined
            : { maxHeight }
      }
    >
      {body}
    </section>
  );

  const rootStyle = {
    "--ansi-row-height": `${rowHeight}px`,
  } as CSSProperties;

  if (chrome === "pane") {
    return (
      <div
        className={cn(
          "ansi-view group relative flex flex-col overflow-hidden rounded-lg border border-border bg-terminal-background font-mono text-terminal-foreground",
          className,
        )}
        style={rootStyle}
      >
        <div className="absolute top-1 right-1 z-10 flex gap-0.5 rounded-md bg-terminal-background opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
          {tools}
        </div>
        {scroller}
      </div>
    );
  }

  const count = text === "" ? 0 : lines.length;
  const countLabel = shown
    ? `${shown.length.toLocaleString("en-US")} of ${lineCountLabel(count)}`
    : lineCountLabel(count);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Ctrl+F from anywhere inside the view goes to its search box
    <div
      className={cn(
        "ansi-view flex flex-col overflow-hidden rounded-lg border border-border bg-terminal-background font-mono text-terminal-foreground",
        className,
      )}
      style={rootStyle}
      onKeyDown={onRootKeyDown}
    >
      {/* One child before the scroller, as in a pane, so that switching
          chrome keeps the scroller mounted and measured. */}
      <div className="shrink-0 border-b border-border bg-card font-sans text-card-foreground text-xs">
        <div className="flex items-center gap-2 py-1 pr-1 pl-3">
          {filename !== undefined && (
            <span className="min-w-0 truncate font-medium">{filename}</span>
          )}
          <span className="shrink-0 text-muted-foreground">
            {done ? countLabel : `Parsing… ${countLabel}`}
          </span>
          <div className="ml-auto flex shrink-0 gap-0.5">
            {tools}
            {downloadUrl !== undefined && (
              <Button asChild size="xs" variant="ghost">
                <a
                  href={downloadUrl}
                  download={filename ?? ""}
                  aria-label="Download"
                  title="Download"
                >
                  <DownloadIcon />
                </a>
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border border-dashed py-1 pr-1 pl-3">
          {parse.levelCounts && text !== "" && (
            <LevelChips
              counts={parse.levelCounts}
              hidden={hidden}
              onChange={(next) => {
                setHidden(next);
                resetNav();
              }}
            />
          )}
          <SearchBox
            className="ml-auto"
            inputRef={searchRef}
            query={query}
            onQuery={(next) => {
              setQuery(next);
              resetNav();
            }}
            counter={{ ...search, current }}
            caseSensitive={caseSensitive}
            onCaseSensitive={(on) => {
              setCaseSensitive(on);
              resetNav();
            }}
            regex={regex}
            onRegex={(on) => {
              setRegex(on);
              resetNav();
            }}
            onlyMatching={onlyMatching}
            onOnlyMatching={setOnlyMatching}
            onStep={stepMatch}
            onLeave={() => scrollRef.current?.focus()}
          />
        </div>
      </div>
      {scroller}
    </div>
  );
}
