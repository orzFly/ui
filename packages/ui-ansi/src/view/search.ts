import type { AnsiLine } from "../parse/types.ts";

/** Matches stored past this many set {@link MatchSink.capped} and stop the scan. */
export const MATCH_CAP = 100_000;

export interface SearchFlags {
  caseSensitive: boolean;
  regex: boolean;
}

// Only the syntax characters: `u` mode rejects identity escapes such as `\-`.
const SYNTAX = /[\\^$.*+?()[\]{}|/]/g;

/** The pattern for `query`; `null` when it is empty, `"invalid"` when it does not compile. */
export function compileQuery(
  query: string,
  { caseSensitive, regex }: SearchFlags,
): RegExp | "invalid" | null {
  if (query === "") return null;
  const source = regex ? query : query.replace(SYNTAX, "\\$&");
  try {
    return new RegExp(source, caseSensitive ? "gu" : "giu");
  } catch {
    return "invalid";
  }
}

export interface MatchSink {
  /** `(lineId, from, to)` triples, UTF-16 offsets into the line's text; the first `count * 3` are set. */
  matches: Uint32Array;
  count: number;
  /** 1 at each line id with a stored match; at least as long as the lines scanned. */
  matchLines: Uint8Array;
  /** True once a match past {@link MATCH_CAP} was found; nothing more is stored. */
  capped: boolean;
}

export function createMatchSink(lineCount = 0): MatchSink {
  return {
    matches: new Uint32Array(3 * 64),
    count: 0,
    matchLines: new Uint8Array(Math.max(lineCount, 64)),
    capped: false,
  };
}

/** Makes `sink.matchLines` cover `lineCount` lines, replacing the array when it grows. */
export function growMatchLines(sink: MatchSink, lineCount: number): void {
  if (sink.matchLines.length >= lineCount) return;
  const next = new Uint8Array(Math.max(lineCount, 2 * sink.matchLines.length));
  next.set(sink.matchLines);
  sink.matchLines = next;
}

function store(sink: MatchSink, id: number, from: number, to: number): void {
  const at = sink.count * 3;
  if (at + 3 > sink.matches.length) {
    const next = new Uint32Array(
      Math.min(2 * sink.matches.length, 3 * MATCH_CAP),
    );
    next.set(sink.matches);
    sink.matches = next;
  }
  sink.matches[at] = id;
  sink.matches[at + 1] = from;
  sink.matches[at + 2] = to;
  sink.count++;
  sink.matchLines[id] = 1;
}

/**
 * Appends every match of `re` (a `g` pattern) in the lines at positions
 * `[from, to)` of `ids`, or of `lines` itself when `ids` is null. Zero-length
 * matches are skipped. Stops early once the sink is capped.
 */
export function scanLines(
  re: RegExp,
  lines: readonly Pick<AnsiLine, "text">[],
  ids: Uint32Array | null,
  from: number,
  to: number,
  sink: MatchSink,
): void {
  if (sink.capped || from >= to) return;
  // `ids` ascend, so its last id is the highest this call can flag.
  growMatchLines(sink, (ids ? ids[to - 1] : to - 1) + 1);
  for (let pos = from; pos < to; pos++) {
    const id = ids ? ids[pos] : pos;
    const text = lines[id].text;
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const end = m.index + m[0].length;
      if (end === m.index) {
        // Step over a whole code point, or `u` would match inside a surrogate pair.
        const cp = text.codePointAt(end);
        re.lastIndex = end + (cp !== undefined && cp > 0xffff ? 2 : 1);
        continue;
      }
      if (sink.count === MATCH_CAP) {
        sink.capped = true;
        return;
      }
      store(sink, id, m.index, end);
    }
  }
}
