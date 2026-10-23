import { type CSSProperties, memo, type ReactNode } from "react";
import {
  LEVEL_INHERITED,
  type LevelMatch,
  levelOfCode,
} from "../parse/levels.ts";
import type { AnsiLine, AnsiStyle } from "../parse/types.ts";

/** A search match's UTF-16 range in the line's text, and whether it is the current match. */
export type RowMark = readonly [from: number, to: number, current: boolean];

export interface AnsiRowProps {
  /** Index of the line in the parse. */
  lineIndex: number;
  line: AnsiLine;
  /** The row's UTF-16 range in `line.text`. */
  from: number;
  to: number;
  styles: readonly AnsiStyle[];
  /** The memoised inline style of a style id. */
  styleOf: (id: number) => CSSProperties;
  /** Digits of the widest line number; 0 draws no gutter. */
  gutterDigits: number;
  /** The line's level code, inherited bit included; 0 is no level. */
  level?: number;
  /** The detector's result for the line, whose word is coloured. */
  levelMatch?: LevelMatch | null;
  /**
   * The line's matches, ascending and not overlapping; the row skips those
   * outside its range. Undefined for a line without matches, so that the row
   * stays memoised.
   */
  marks?: readonly RowMark[];
  /** The line does not follow the previous shown line. */
  gap?: boolean;
}

/** Cells between the gutter's rule and the text. */
export const GUTTER_TEXT_GAP = 1;

/** Cells the gutter takes: the digits, a cell on each side of the rule. */
export function gutterCells(gutterDigits: number): number {
  return gutterDigits > 0 ? gutterDigits + 1 + GUTTER_TEXT_GAP : 0;
}

const colouredLines = new WeakMap<AnsiLine, boolean>();

/** Whether a run sets its own colours, which then win over the level's. */
function isColoured(line: AnsiLine, styles: readonly AnsiStyle[]): boolean {
  let coloured = colouredLines.get(line);
  if (coloured === undefined) {
    coloured = false;
    for (let i = 1; i < line.runs.length; i += 2) {
      const style = styles[line.runs[i]];
      if (style && (style.fg || style.bg || style.inverse)) {
        coloured = true;
        break;
      }
    }
    colouredLines.set(line, coloured);
  }
  return coloured;
}

/** Index of the first mark ending after `at`, or the marks' length. */
function firstMarkEndingAfter(marks: readonly RowMark[], at: number): number {
  let lo = 0;
  let hi = marks.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (marks[mid][1] <= at) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * One visual row. Its text is exactly `line.text.slice(from, to)`, in
 * `[data-text]`, which the view's copy handler relies on to map a selection
 * back to the line.
 */
export const AnsiRow = memo(function AnsiRow({
  lineIndex,
  line,
  from,
  to,
  styles,
  styleOf,
  gutterDigits,
  level = 0,
  levelMatch,
  marks,
  gap,
}: AnsiRowProps) {
  const { text, runs } = line;
  const levelName = levelOfCode(level);
  const coloured = levelName !== null && isColoured(line, styles);
  const wordFrom = coloured ? undefined : levelMatch?.from;
  const wordTo = coloured ? undefined : levelMatch?.to;
  const splits = wordFrom !== undefined || marks !== undefined;
  // A long line can carry many thousands of marks; each row visits only its own.
  const firstMark = marks ? firstMarkEndingAfter(marks, from) : 0;

  const cuts: number[] = [];
  for (let i = 0; i < runs.length; i += 2) {
    if (runs[i] < to) cuts.push(Math.max(runs[i], from));
  }
  if (splits) {
    const cutAt = (at: number | undefined) => {
      if (at !== undefined && at > from && at < to) cuts.push(at);
    };
    cutAt(wordFrom);
    cutAt(wordTo);
    if (marks) {
      for (let i = firstMark; i < marks.length && marks[i][0] < to; i++) {
        cutAt(marks[i][0]);
        cutAt(marks[i][1]);
      }
    }
    cuts.sort((a, b) => a - b);
  }

  const spans: ReactNode[] = [];
  let run = 0;
  let mark = firstMark;
  for (let c = 0; c < cuts.length; c++) {
    const start = cuts[c];
    const end = c + 1 < cuts.length ? cuts[c + 1] : to;
    if (start >= end) continue;
    while (run + 2 < runs.length && runs[run + 2] <= start) run += 2;
    const id = runs[run + 1];
    let inWord = false;
    let match: string | undefined;
    if (splits) {
      inWord =
        wordFrom !== undefined &&
        wordTo !== undefined &&
        start >= wordFrom &&
        end <= wordTo;
      while (marks && mark < marks.length && marks[mark][1] <= start) mark++;
      const m = marks?.[mark];
      if (m && m[0] <= start) match = m[2] ? "current" : "";
    }
    const attrs = {
      style: styleOf(id),
      "data-level-word": inWord ? "" : undefined,
      "data-match": match,
    };
    const chunk = text.slice(start, end);
    const href = styles[id]?.href;
    spans.push(
      href ? (
        <a
          key={start}
          {...attrs}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="ansi-link"
        >
          {chunk}
        </a>
      ) : (
        <span key={start} {...attrs}>
          {chunk}
        </span>
      ),
    );
  }
  return (
    <div
      data-line={lineIndex}
      data-from={from}
      data-level={levelName ?? undefined}
      data-inherited={levelName && level & LEVEL_INHERITED ? "" : undefined}
      data-coloured={coloured ? "" : undefined}
      data-gap={gap && from === 0 ? "" : undefined}
      className="relative flex h-(--ansi-row-height) leading-(--ansi-row-height) whitespace-pre"
    >
      {gutterDigits > 0 && (
        // The number is a pseudo-element, so it is never selected or copied.
        <span
          aria-hidden
          data-gutter=""
          data-n={from === 0 ? lineIndex + 1 : undefined}
          className="shrink-0 pr-[1ch] text-right text-ansi-bright-black select-none before:content-[attr(data-n)]"
          style={{
            width: `${gutterCells(gutterDigits) - GUTTER_TEXT_GAP}ch`,
            marginRight: `${GUTTER_TEXT_GAP}ch`,
          }}
        />
      )}
      <span data-text="">{spans}</span>
    </div>
  );
});
