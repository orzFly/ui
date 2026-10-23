import { LEVEL_INHERITED, type LogLevel, levelCode } from "../parse/levels.ts";

const ALL_LEVELS = 0x7f;

/** Bit `c` set for each level code `c` the filter shows; bit 0 is Other. */
export function levelMask(hidden: ReadonlySet<LogLevel | "other">): number {
  let mask = ALL_LEVELS;
  for (const level of hidden) {
    mask &= ~(1 << (level === "other" ? 0 : levelCode(level)));
  }
  return mask;
}

/**
 * The ids of lines `[0, count)` whose level `mask` shows and, with
 * `matchLines`, that have a match; `null` when no line can be filtered out.
 * `levels` of `null` makes every line Other.
 */
export function buildShownLines(
  count: number,
  levels: Uint8Array | null,
  mask: number,
  matchLines: Uint8Array | null,
): Uint32Array | null {
  return appendShownLines(null, 0, count, levels, mask, matchLines);
}

/**
 * `prev`, built by {@link buildShownLines} over lines before `from`, extended
 * with the ids in `[from, to)` that pass. `prev` keeps reading as it did.
 */
export function appendShownLines(
  prev: Uint32Array | null,
  from: number,
  to: number,
  levels: Uint8Array | null,
  mask: number,
  matchLines: Uint8Array | null,
): Uint32Array | null {
  if ((mask & ALL_LEVELS) === ALL_LEVELS && !matchLines) return null;
  const start = prev ? prev.length : 0;
  const needed = start + Math.max(0, to - from);
  let out: Uint32Array;
  // Lines and matches arrive a slice at a time; spare capacity keeps each
  // append from copying the whole list.
  if (prev && prev.byteOffset === 0 && prev.buffer.byteLength >= needed * 4) {
    out = new Uint32Array(prev.buffer, 0, needed);
  } else {
    out = new Uint32Array(Math.max(needed, 2 * start));
    if (prev) out.set(prev);
  }
  let n = start;
  for (let i = from; i < to; i++) {
    const code = levels ? levels[i] & ~LEVEL_INHERITED : 0;
    if (!(mask & (1 << code))) continue;
    if (matchLines && !matchLines[i]) continue;
    out[n++] = i;
  }
  return out.subarray(0, n);
}
