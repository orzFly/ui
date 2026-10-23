import { Button } from "@orz/ui/components/button";
import { copyToClipboard } from "@orz/ui/lib/clipboard";
import { cn } from "@orz/ui/lib/utils";
import { CopyIcon, DownloadIcon, WrapTextIcon } from "lucide-react";
import {
  type ClipboardEvent,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { stripAnsi } from "../parse/parser.ts";
import type { AnsiLine } from "../parse/types.ts";
import {
  buildRowIndex,
  columnsFor,
  lineAtRow,
  splitRows,
  VIRTUALIZE_ABOVE,
} from "./geometry.ts";
import { useCellMetrics } from "./metrics.ts";
import { AnsiRow, GUTTER_TEXT_GAP, gutterCells } from "./row.tsx";
import { createStyleCache } from "./run-style.ts";
import { useAnsiLines } from "./use-ansi-lines.ts";
import { VirtualRows } from "./virtual-rows.tsx";

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
  index: Uint32Array;
}

function rangesOf(line: AnsiLine, cols: number | null): readonly RowRange[] {
  return cols === null || line.cells <= cols
    ? [[0, line.text.length, 0]]
    : splitRows(line, cols);
}

/** The row of layout `to` that holds the text at `row` of layout `from`. */
function carryRow(row: number, from: Layout, to: Layout): number {
  if (from.cols === to.cols || from.lines !== to.lines) return row;
  const lineIndex = lineAtRow(from.index, row);
  const line = to.lines[lineIndex];
  if (!line || lineIndex >= to.index.length - 1) return row;
  const at = rangesOf(line, from.cols)[row - from.index[lineIndex]]?.[0] ?? 0;
  const ranges = rangesOf(line, to.cols);
  let k = 0;
  while (k + 1 < ranges.length && ranges[k + 1][0] <= at) k++;
  return to.index[lineIndex] + k;
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
  className,
}: AnsiViewProps) {
  const parse = useAnsiLines(text);
  const { lines, styles, maxCells, done } = parse;
  const [wrap, setWrap] = useState(initialWrap);
  const scrollRef = useRef<HTMLElement>(null);
  const { rowHeight, cellWidth, width, viewportHeight } =
    useCellMetrics(scrollRef);

  const gutterDigits =
    chrome === "file" ? String(Math.max(1, lines.length)).length : 0;
  const gutterWidth = gutterCells(gutterDigits) * cellWidth;
  const cols = wrap ? columnsFor(width - gutterWidth, cellWidth) : null;
  // `lines` grows in place while a large text streams in: each published
  // snapshot extends the last index, and its length is the line count drawn.
  const lastLayout = useRef<Layout | null>(null);
  const layout = useMemo((): Layout => {
    const last = lastLayout.current;
    const prev =
      last && last.lines === parse.lines && last.cols === cols
        ? last.index
        : undefined;
    const next = {
      lines: parse.lines,
      cols,
      index: buildRowIndex(parse.lines, cols, prev),
    };
    lastLayout.current = next;
    return next;
  }, [parse, cols]);
  const { index } = layout;
  const lineCount = index.length - 1;
  const totalRows = index[lineCount];
  // While a large text streams in, its rows so far undercount it; judged by
  // them alone, the first slices would mount thousands of rows only to drop
  // them a tick later.
  const virtual =
    (parse.parsed > 0 ? totalRows / parse.parsed : totalRows) >
    VIRTUALIZE_ABOVE;

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

  const renderRow = (lineIndex: number, range: RowRange | undefined) => {
    const line = lines[lineIndex];
    const [from, to] = range ?? [line.text.length, line.text.length];
    return (
      <AnsiRow
        key={`${lineIndex}:${from}`}
        lineIndex={lineIndex}
        line={line}
        from={from}
        to={to}
        styles={styles}
        styleOf={styleOf}
        gutterDigits={gutterDigits}
      />
    );
  };

  const renderVirtualRow = (row: number) => {
    const lineIndex = lineAtRow(index, row);
    const ranges = rowsOfLine(lines[lineIndex]);
    return renderRow(lineIndex, ranges[row - index[lineIndex]]);
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
      />
    );
  } else {
    const rows: ReactNode[] = [];
    for (let i = 0; i < lineCount; i++) {
      for (const range of rowsOfLine(lines[i])) rows.push(renderRow(i, range));
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
      for (let i = start.line + 1; i < end.line; i++) parts.push(lines[i].text);
      parts.push(lines[end.line].text.slice(0, end.at));
      copied = parts.join("\n");
    }
    event.clipboardData.setData("text/plain", copied);
    event.preventDefault();
  };

  const copyAll = () => {
    // Once parsed, the lines already are the stripped text; parsing a large
    // log again would block for as long as the first parse took.
    const plain = done
      ? lines.map((line) => line.text).join("\n")
      : stripAnsi(text);
    void copyToClipboard(plain, "Copied output");
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

  const count = text === "" ? 0 : lineCount;
  return (
    <div
      className={cn(
        "ansi-view flex flex-col overflow-hidden rounded-lg border border-border bg-terminal-background font-mono text-terminal-foreground",
        className,
      )}
      style={rootStyle}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card py-1 pr-1 pl-3 font-sans text-card-foreground text-xs">
        {filename !== undefined && (
          <span className="min-w-0 truncate font-medium">{filename}</span>
        )}
        <span className="shrink-0 text-muted-foreground">
          {done ? lineCountLabel(count) : `Parsing… ${lineCountLabel(count)}`}
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
      {scroller}
    </div>
  );
}
