import { useEffect, useState, useSyncExternalStore } from "react";
import type { AnsiLine } from "../parse/types.ts";
import {
  compileQuery,
  createMatchSink,
  growMatchLines,
  type MatchSink,
  type SearchFlags,
  scanLines,
} from "./search.ts";
import { runSlices } from "./time-slices.ts";

/** How long the query and flags must stay unchanged before a scan starts. */
export const SEARCH_DEBOUNCE_MS = 150;
// Lines scanned between deadline checks.
const CHUNK = 256;

export interface SearchInput extends SearchFlags {
  query: string;
  /** Grows in place while a large text is parsed. */
  lines: readonly AnsiLine[];
  /** The lines complete so far; a rise means `lines` grew. */
  count: number;
  /** False while more lines may still arrive. */
  done: boolean;
  /** The ids the level filter shows, ascending; `null` for every line. */
  shown: Uint32Array | null;
}

export interface SearchState {
  /** `(lineId, from, to)` triples, `count * 3` long. */
  readonly matches: Uint32Array;
  readonly count: number;
  /** More matches exist than were stored. */
  readonly capped: boolean;
  /** The counts may still rise: a scan is pending, running, or waiting for lines. */
  readonly scanning: boolean;
  /** 1 at each line id with a match; at least `count` lines long. Replaced as it grows. */
  readonly matchLines: Uint8Array;
  readonly error: "invalid" | null;
  /** Changes whenever the scan starts over, so a match index is only good within one. */
  readonly generation: number;
}

/**
 * True when `next` keeps the first `scanned` ids of `prev`, so the scan can
 * carry on. `appendShownLines` writes into its spare capacity, so a shared
 * buffer settles it at once; otherwise the scanned prefix is compared.
 */
function extendsShown(
  prev: Uint32Array | null,
  next: Uint32Array | null,
  scanned: number,
): boolean {
  if (!prev || !next) return prev === next;
  if (next.length < scanned) return false;
  if (next.buffer === prev.buffer && next.byteOffset === prev.byteOffset) {
    return true;
  }
  for (let i = 0; i < scanned; i++) if (next[i] !== prev[i]) return false;
  return true;
}

class SearchStore {
  private readonly listeners = new Set<() => void>();
  private input: SearchInput | null = null;
  private re: RegExp | null = null;
  private error: "invalid" | null = null;
  private sink: MatchSink = createMatchSink();
  // The lines and shown list the scan has read from; `cursor` positions in them.
  private lines: readonly AnsiLine[] = [];
  private shown: Uint32Array | null = null;
  private cursor = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopSlices: (() => void) | null = null;
  private generation = 0;
  private snapshot: SearchState = {
    matches: new Uint32Array(0),
    count: 0,
    capped: false,
    scanning: false,
    matchLines: this.sink.matchLines,
    error: null,
    generation: 0,
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  update(next: SearchInput): void {
    const prev = this.input;
    this.input = next;
    if (next.query === "") {
      this.halt();
      this.re = null;
      this.error = null;
      if (this.sink.count > 0 || this.sink.capped) {
        this.sink = createMatchSink(next.count);
      }
    } else {
      const retyped =
        !prev ||
        prev.query !== next.query ||
        prev.caseSensitive !== next.caseSensitive ||
        prev.regex !== next.regex;
      // Results scanned from other text, or from lines the filter now hides,
      // must not outlive the wait: their ids no longer point where they did.
      const stale =
        this.re !== null &&
        (next.lines !== this.lines ||
          !extendsShown(this.shown, next.shown, this.cursor));
      if (retyped || (stale && this.timer !== undefined)) {
        // Typing restarts the wait; the last results stay up until it ends.
        if (retyped) this.halt();
        if (stale) this.drop(next);
        if (retyped) {
          this.timer = setTimeout(() => {
            this.timer = undefined;
            this.begin();
          }, SEARCH_DEBOUNCE_MS);
        }
      } else if (stale) {
        this.begin();
        return;
      } else if (this.re) {
        this.shown = next.shown;
        if (this.timer === undefined) this.kick();
      }
    }
    this.publish();
  }

  /** Stops the wait and the scan; the next {@link update} starts afresh. */
  stop(): void {
    this.halt();
    this.input = null;
  }

  private halt(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.stopSlices?.();
    this.stopSlices = null;
  }

  private drop(next: SearchInput): void {
    this.generation++;
    this.sink = createMatchSink(next.count);
    this.lines = next.lines;
    this.shown = next.shown;
    this.cursor = 0;
  }

  private total(): number {
    return this.shown ? this.shown.length : (this.input?.count ?? 0);
  }

  private begin(): void {
    const input = this.input;
    if (!input) return;
    this.halt();
    const re = compileQuery(input.query, input);
    this.re = re instanceof RegExp ? re : null;
    this.generation++;
    this.error = re === "invalid" ? "invalid" : null;
    this.sink = createMatchSink(input.count);
    this.lines = input.lines;
    this.shown = input.shown;
    this.cursor = 0;
    this.kick();
    this.publish();
  }

  private kick(): void {
    const re = this.re;
    if (!re || this.stopSlices || this.sink.capped) return;
    if (this.cursor >= this.total()) return;
    const sink = this.sink;
    const step = (deadline: number): boolean => {
      for (;;) {
        const end = Math.min(this.cursor + CHUNK, this.total());
        scanLines(re, this.lines, this.shown, this.cursor, end, sink);
        this.cursor = end;
        if (sink.capped || end >= this.total()) {
          this.stopSlices = null;
          return true;
        }
        if (performance.now() >= deadline) return false;
      }
    };
    this.stopSlices = runSlices(step, () => this.publish());
  }

  private publish(): void {
    const sink = this.sink;
    growMatchLines(sink, this.input?.count ?? 0);
    const scanning =
      this.timer !== undefined ||
      (this.re !== null &&
        !sink.capped &&
        (this.cursor < this.total() || !this.input?.done));
    const prev = this.snapshot;
    if (
      prev.count === sink.count &&
      prev.capped === sink.capped &&
      prev.scanning === scanning &&
      prev.matchLines === sink.matchLines &&
      prev.error === this.error &&
      prev.generation === this.generation &&
      prev.matches.buffer === sink.matches.buffer
    ) {
      return;
    }
    this.snapshot = {
      matches: sink.matches.subarray(0, sink.count * 3),
      count: sink.count,
      capped: sink.capped,
      scanning,
      matchLines: sink.matchLines,
      error: this.error,
      generation: this.generation,
    };
    for (const listener of this.listeners) listener();
  }
}

/**
 * Every match of `query` in the lines `shown` lists, found in time slices
 * {@link SEARCH_DEBOUNCE_MS} after the query or flags last changed. Lines that
 * arrive while parsing, and ids appended to `shown`, are scanned as they come;
 * any other change to `lines` or `shown` starts the scan over.
 */
export function useSearch(input: SearchInput): SearchState {
  const [store] = useState(() => new SearchStore());
  const { query, caseSensitive, regex, lines, count, done, shown } = input;
  useEffect(() => {
    store.update({ query, caseSensitive, regex, lines, count, done, shown });
  }, [store, query, caseSensitive, regex, lines, count, done, shown]);
  useEffect(() => () => store.stop(), [store]);
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}
