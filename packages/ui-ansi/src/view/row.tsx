import { type CSSProperties, memo, type ReactNode } from "react";
import type { AnsiLine, AnsiStyle } from "../parse/types.ts";

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
}: AnsiRowProps) {
  const { text, runs } = line;
  const spans: ReactNode[] = [];
  for (let i = 0; i < runs.length; i += 2) {
    const start = Math.max(runs[i], from);
    const end = Math.min(i + 2 < runs.length ? runs[i + 2] : text.length, to);
    if (start >= end) continue;
    const id = runs[i + 1];
    const chunk = text.slice(start, end);
    const href = styles[id]?.href;
    spans.push(
      href ? (
        <a
          key={start}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="ansi-link"
          style={styleOf(id)}
        >
          {chunk}
        </a>
      ) : (
        <span key={start} style={styleOf(id)}>
          {chunk}
        </span>
      ),
    );
  }
  return (
    <div
      data-line={lineIndex}
      data-from={from}
      className="flex h-(--ansi-row-height) leading-(--ansi-row-height) whitespace-pre"
    >
      {gutterDigits > 0 && (
        // The number is a pseudo-element, so it is never selected or copied.
        <span
          aria-hidden
          data-gutter=""
          data-n={from === 0 ? lineIndex + 1 : undefined}
          className="shrink-0 pr-[1ch] text-right text-ansi-bright-black select-none before:content-[attr(data-n)]"
          style={{ width: `${gutterDigits + 1}ch` }}
        />
      )}
      <span data-text="">{spans}</span>
    </div>
  );
});
