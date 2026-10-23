export type AnsiColor =
  /** 0–15 follow the theme's `--ansi-*`; 16–255 are xterm's fixed values. */
  | { kind: "palette"; index: number }
  | { kind: "rgb"; r: number; g: number; b: number };

export type UnderlineStyle =
  | "single"
  | "double"
  | "curly"
  | "dotted"
  | "dashed";

export interface AnsiStyle {
  fg?: AnsiColor;
  bg?: AnsiColor;
  underlineColor?: AnsiColor;
  bold?: true;
  dim?: true;
  italic?: true;
  underline?: UnderlineStyle;
  blink?: true;
  inverse?: true;
  hidden?: true;
  strike?: true;
  overline?: true;
  /** An OSC 8 link target, already checked against the scheme allow-list. */
  href?: string;
}

export interface AnsiLine {
  /** The line's visible characters, escapes removed. */
  text: string;
  /** Flat `[startOffsetInText, styleId]` pairs, ascending; style 0 is the empty style. */
  runs: Uint32Array;
  /** Display width in terminal cells. */
  cells: number;
}

export interface AnsiParse {
  readonly lines: readonly AnsiLine[];
  /** Interned; a run's style id indexes this. */
  readonly styles: readonly AnsiStyle[];
  /** The widest line, for the no-wrap scroll width. */
  readonly maxCells: number;
}

export interface AnsiParser extends AnsiParse {
  /** Takes the text split anywhere: an escape cut in half is carried over to the next push. */
  push(chunk: string): void;
  /** Flushes the last line; the text needs no trailing newline. */
  end(): void;
}
