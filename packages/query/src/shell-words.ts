/**
 * Shell words: the subset of POSIX `sh` quoting that command lines use and
 * that a query schema can opt into. Backslash escapes one character, `'…'`
 * is literal, `"…"` allows `\"` and `\\`. There are no `$`, globs, `~`,
 * pipes or comments: those characters are ordinary, so pasting a URL or a
 * path needs no thought.
 */

export type ShellSegment = {
  /** Offsets of the segment's source, quotes and backslash included. */
  start: number;
  end: number;
  quoted: "none" | "single" | "double" | "escape";
};

export type ShellWord = {
  /** Offsets in the scanned text, shifted by `offset`. */
  start: number;
  end: number;
  raw: string;
  /** Quotes and escapes removed. */
  value: string;
  /**
   * Which characters were quoted or escaped. Brace expansion and painting
   * read these, so the distinction survives quote removal.
   */
  segments: ShellSegment[];
  /** A quote was still open at the end. */
  unclosed?: boolean;
};

const isSpace = (ch: string): boolean => /\s/.test(ch);

/** Length of the code point at `i`, so `\` never splits a surrogate pair. */
function codePointLength(text: string, i: number): number {
  const cp = text.codePointAt(i);
  return cp !== undefined && cp > 0xffff ? 2 : 1;
}

/** Never throws: every string has a reading. */
export function shellWords(text: string, offset = 0): ShellWord[] {
  const words: ShellWord[] = [];
  let i = 0;
  while (i < text.length) {
    if (isSpace(text[i] as string)) {
      i += 1;
      continue;
    }
    const start = i;
    const segments: ShellSegment[] = [];
    let value = "";
    let unclosed = false;
    while (i < text.length && !isSpace(text[i] as string)) {
      const ch = text[i] as string;
      if (ch === "'") {
        const close = text.indexOf("'", i + 1);
        const end = close === -1 ? text.length : close + 1;
        value += text.slice(i + 1, close === -1 ? end : close);
        if (close === -1) unclosed = true;
        segments.push({ start: i, end, quoted: "single" });
        i = end;
      } else if (ch === '"') {
        let j = i + 1;
        let closed = false;
        while (j < text.length) {
          const c = text[j] as string;
          if (c === '"') {
            closed = true;
            j += 1;
            break;
          }
          const next = text[j + 1];
          if (c === "\\" && (next === '"' || next === "\\")) {
            value += next;
            j += 2;
            continue;
          }
          value += c;
          j += 1;
        }
        if (!closed) unclosed = true;
        segments.push({ start: i, end: j, quoted: "double" });
        i = j;
      } else if (ch === "\\" && i + 1 < text.length) {
        const len = 1 + codePointLength(text, i + 1);
        value += text.slice(i + 1, i + len);
        segments.push({ start: i, end: i + len, quoted: "escape" });
        i += len;
      } else {
        // A trailing lone `\` has nothing to escape and stays literal.
        const last = segments.at(-1);
        if (last?.quoted === "none" && last.end === i) last.end = i + 1;
        else segments.push({ start: i, end: i + 1, quoted: "none" });
        value += ch;
        i += 1;
      }
    }
    words.push({
      start: start + offset,
      end: i + offset,
      raw: text.slice(start, i),
      value,
      segments: segments.map((s) => ({
        ...s,
        start: s.start + offset,
        end: s.end + offset,
      })),
      ...(unclosed ? { unclosed: true } : {}),
    });
  }
  return words;
}

/**
 * What one segment contributes to the word's value. `word` must be the word
 * the segment belongs to.
 */
export function segmentValue(word: ShellWord, segment: ShellSegment): string {
  const raw = word.raw.slice(
    segment.start - word.start,
    segment.end - word.start,
  );
  switch (segment.quoted) {
    case "none":
      return raw;
    case "escape":
      return raw.slice(1);
    case "single":
      return raw.slice(1, raw.endsWith("'") && raw.length > 1 ? -1 : undefined);
    case "double": {
      const closed = raw.length > 1 && raw.endsWith('"') && !endsEscaped(raw);
      const inner = raw.slice(1, closed ? -1 : undefined);
      return inner.replace(/\\(["\\])/g, "$1");
    }
  }
}

/** Whether the closing `"` of a double-quoted segment is really `\"`. */
function endsEscaped(raw: string): boolean {
  let backslashes = 0;
  for (let i = raw.length - 2; i >= 1 && raw[i] === "\\"; i -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

/**
 * Commas and braces are quoted too, although `shellWords` does not care
 * about them: the word may land inside a brace group, where a bare one
 * would split it.
 */
const SAFE = /^[^\s'"\\{},]+$/;

/** Bare when safe, else `'…'`, else `"…"`. Round-trips through `shellWords`. */
export function quoteShellWord(value: string): string {
  if (SAFE.test(value)) return value;
  if (!value.includes("'")) return `'${value}'`;
  return `"${value.replace(/["\\]/g, "\\$&")}"`;
}
