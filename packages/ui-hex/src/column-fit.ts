/** Measured widths, in px, that a row's width is built from. */
export interface ColumnMetrics {
  /** Everything but the columns: the address and the gap before the text pane. */
  fixed: number;
  /** One hex cell and its text-pane twin. */
  column: number;
  /** What a group-end cell adds over a plain one. */
  groupGap: number;
  groupSize: number;
}

/** The counts `columns="auto"` picks from, widest first: `max`, then the powers of two below it, down to 4. */
export function columnChoices(max: number): number[] {
  const out = [max];
  let n = 2 ** Math.ceil(Math.log2(max) - 1);
  while (n >= 4 && n < max) {
    out.push(n);
    n /= 2;
  }
  return out;
}

export function rowWidth(columns: number, m: ColumnMetrics) {
  const groupEnds =
    m.groupSize > 0 ? Math.floor((columns - 1) / m.groupSize) : 0;
  return m.fixed + columns * m.column + groupEnds * m.groupGap;
}

/** The widest choice whose row fits `available` px; the narrowest when none does. */
export function fitColumns(available: number, max: number, m: ColumnMetrics) {
  const choices = columnChoices(max);
  // Half a pixel of slack: the widths come from rounded layout boxes.
  return (
    choices.find((n) => rowWidth(n, m) <= available + 0.5) ??
    (choices.at(-1) as number)
  );
}
