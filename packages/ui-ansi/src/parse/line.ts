import { cellWidth } from "@orz/ui/lib/cell-width";

import type { AnsiLine } from "./types.ts";

/** The cell width of a code point that is not a control; a lone surrogate takes 1. */
export function codePointCells(codePoint: number): 0 | 1 | 2 {
  if (codePoint < 0x300 || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
    return 1;
  }
  return cellWidth(codePoint);
}

/** Marks the right half of a wide character in the cell buffer. */
const CONTINUATION = "";
const TAB = 8;
const EMPTY_RUNS = new Uint32Array(0);

/**
 * Builds one line at a time. Text that only moves the cursor forwards is
 * appended to `text` and `runs` directly; the first backward move switches
 * the line to a cell buffer, compacted back at `finish`.
 */
export class LineBuilder {
  private text = "";
  private cells = 0;
  private runs = new Uint32Array(64);
  private runCount = 0;

  private slow = false;
  // `\r` is resolved lazily, so a CRLF line never leaves the fast path.
  private crPending = false;
  private chars: string[] = [];
  private ids: number[] = [];
  private cursor = 0;
  // Zero-width code points with no cell before them to attach to.
  private prefix = "";
  private prefixId = 0;

  /**
   * Writes `chunk[start, end)`, printable code points only. `cells` is its
   * width; the cell buffer measures each code point again instead.
   */
  write(
    chunk: string,
    start: number,
    end: number,
    cells: number,
    id: number,
  ): void {
    if (start >= end) return;
    this.resolve();
    if (!this.slow) {
      this.append(chunk.slice(start, end), cells, id);
      return;
    }
    let i = start;
    while (i < end) {
      const c = chunk.charCodeAt(i);
      let next = i + 1;
      let codePoint = c;
      if (c >= 0xd800 && c <= 0xdbff && next < end) {
        const d = chunk.charCodeAt(next);
        if (d >= 0xdc00 && d <= 0xdfff) {
          codePoint = ((c - 0xd800) << 10) + (d - 0xdc00) + 0x10000;
          next++;
        }
      }
      this.put(chunk.slice(i, next), codePointCells(codePoint), id);
      i = next;
    }
  }

  carriageReturn(): void {
    if (this.slow) this.cursor = 0;
    else if (this.cells > 0) this.crPending = true;
  }

  backspace(): void {
    this.backward(1);
  }

  tab(id: number): void {
    this.resolve();
    if (!this.slow) {
      const n = TAB - (this.cells % TAB);
      this.append(" ".repeat(n), n, id);
      return;
    }
    const target = (Math.floor(this.cursor / TAB) + 1) * TAB;
    this.pad(this.cursor);
    while (this.chars.length < target) {
      this.chars.push(" ");
      this.ids.push(id);
    }
    this.cursor = target;
  }

  /** `CSI n C`. */
  forward(n: number): void {
    this.resolve();
    if (!this.slow) {
      this.append(" ".repeat(n), n, 0);
      return;
    }
    this.cursor += n;
    this.pad(this.cursor);
  }

  /** `CSI n D`, and `\b` as one cell. */
  backward(n: number): void {
    this.resolve();
    if (!this.slow) {
      if (this.cells === 0) return;
      this.toSlow();
    }
    this.cursor = Math.max(0, this.cursor - n);
  }

  /** `CSI n G`, with `column` 0-based. */
  column(column: number): void {
    this.resolve();
    if (!this.slow) {
      if (column >= this.cells) {
        const n = column - this.cells;
        if (n > 0) this.append(" ".repeat(n), n, 0);
        return;
      }
      this.toSlow();
    }
    this.cursor = column;
    this.pad(column);
  }

  /** `CSI n K`: 0 to the end, 1 from the start, 2 the whole line. */
  erase(mode: number): void {
    this.resolve();
    if (!this.slow) {
      // The cursor is at the end, so there is nothing after it to erase,
      // unless it is at column 0 behind zero-width code points alone.
      if (this.text === "" || (mode === 0 && this.cells > 0)) return;
      this.toSlow();
    }
    const { chars, ids } = this;
    const at = this.cursor;
    if (mode === 0) {
      if (at === 0) this.prefix = "";
      if (at >= chars.length) return;
      // The erase cut a wide character in half.
      if (chars[at] === CONTINUATION) chars[at - 1] = " ";
      chars.length = at;
      ids.length = at;
      return;
    }
    this.prefix = "";
    if (mode === 2) {
      chars.length = 0;
      ids.length = 0;
      return;
    }
    const last = Math.min(this.cursor, chars.length - 1);
    for (let x = 0; x <= last; x++) {
      chars[x] = " ";
      ids[x] = 0;
    }
    if (chars[last + 1] === CONTINUATION) chars[last + 1] = " ";
  }

  /** Ends the line and starts the next one. */
  finish(): AnsiLine {
    const line = this.slow ? this.compact() : this.flushFast();
    this.text = "";
    this.cells = 0;
    this.runCount = 0;
    this.slow = false;
    this.crPending = false;
    this.chars.length = 0;
    this.ids.length = 0;
    this.cursor = 0;
    this.prefix = "";
    this.prefixId = 0;
    return line;
  }

  private flushFast(): AnsiLine {
    const runs =
      this.runCount === 0 ? EMPTY_RUNS : this.runs.slice(0, this.runCount * 2);
    return { text: this.text, runs, cells: this.cells };
  }

  private compact(): AnsiLine {
    this.text = "";
    this.runCount = 0;
    if (this.prefix !== "") this.appendText(this.prefix, this.prefixId);
    const { chars, ids } = this;
    for (let x = 0; x < chars.length; x++) {
      const char = chars[x] as string;
      if (char !== CONTINUATION) this.appendText(char, ids[x] as number);
    }
    this.cells = chars.length;
    return this.flushFast();
  }

  private append(text: string, cells: number, id: number): void {
    const n = this.runCount;
    let rest = text;
    if (n > 0 && this.runs[n * 2 - 1] !== id) {
      // Zero-width code points belong to the cell before them, so they keep
      // its style, as they do in the cell buffer.
      let i = 0;
      while (i < text.length) {
        const codePoint = text.codePointAt(i) as number;
        if (codePointCells(codePoint) !== 0) break;
        i += codePoint > 0xffff ? 2 : 1;
      }
      if (i > 0) {
        this.text += text.slice(0, i);
        rest = text.slice(i);
      }
    }
    if (rest !== "") this.appendText(rest, id);
    this.cells += cells;
  }

  private appendText(text: string, id: number): void {
    const n = this.runCount;
    if (n === 0 || this.runs[n * 2 - 1] !== id) {
      if (n * 2 + 2 > this.runs.length) {
        const grown = new Uint32Array(this.runs.length * 2);
        grown.set(this.runs);
        this.runs = grown;
      }
      this.runs[n * 2] = this.text.length;
      this.runs[n * 2 + 1] = id;
      this.runCount = n + 1;
    }
    this.text += text;
  }

  private resolve(): void {
    if (!this.crPending) return;
    this.crPending = false;
    this.toSlow();
    this.cursor = 0;
  }

  /** Replays the fast path's text into the cell buffer. */
  private toSlow(): void {
    const { text, runs, runCount } = this;
    this.slow = true;
    let run = 0;
    let i = 0;
    while (i < text.length) {
      while (run + 1 < runCount && (runs[(run + 1) * 2] as number) <= i) run++;
      const id = runs[run * 2 + 1] as number;
      const codePoint = text.codePointAt(i) as number;
      const next = i + (codePoint > 0xffff ? 2 : 1);
      this.put(text.slice(i, next), codePointCells(codePoint), id);
      i = next;
    }
  }

  private pad(to: number): void {
    while (this.chars.length < to) {
      this.chars.push(" ");
      this.ids.push(0);
    }
  }

  private put(char: string, width: 0 | 1 | 2, id: number): void {
    const { chars, ids } = this;
    if (width === 0) {
      this.pad(this.cursor);
      let x = this.cursor - 1;
      if (x >= 0 && chars[x] === CONTINUATION) x--;
      if (x < 0) {
        if (this.prefix === "") this.prefixId = id;
        this.prefix += char;
      } else {
        chars[x] += char;
      }
      return;
    }
    const at = this.cursor;
    this.pad(at);
    const end = at + width;
    // Overwriting either half of a wide character blanks the other half.
    if (chars[at] === CONTINUATION && at > 0) chars[at - 1] = " ";
    if (chars[end] === CONTINUATION) chars[end] = " ";
    chars[at] = char;
    ids[at] = id;
    if (width === 2) {
      chars[at + 1] = CONTINUATION;
      ids[at + 1] = id;
    }
    this.cursor = end;
  }
}
