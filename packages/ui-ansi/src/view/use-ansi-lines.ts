import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  createLevelTracker,
  type LevelCounts,
  type LevelTracker,
} from "../parse/level-tracker.ts";
import type { LevelDetector } from "../parse/levels.ts";
import { createAnsiParser, parseAnsi } from "../parse/parser.ts";
import type { AnsiParse, AnsiParser } from "../parse/types.ts";

/** Text up to this many UTF-16 units is parsed in one go during render. */
export const SYNC_PARSE_MAX = 1 << 20;
const SLICE = 1 << 16;
const SLICE_BUDGET_MS = 8;

export interface AnsiLines extends AnsiParse {
  /** False while a large text is still being parsed in the background. */
  readonly done: boolean;
  /** Bumped on every publish; `lines` itself grows in place. */
  readonly version: number;
  /** The share of the text parsed so far, from 0 to 1. */
  readonly parsed: number;
  /**
   * One level code per line of `lines`, null when levels are off. Like
   * `lines`, it covers the lines parsed so far.
   */
  readonly levels: Uint8Array | null;
  readonly levelCounts: LevelCounts | null;
}

interface LinesStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): AnsiLines;
  /** Runs the parse until done or the returned stop is called. */
  start(): () => void;
}

const noop = () => {};

function staticStore(snapshot: AnsiLines): LinesStore {
  return {
    subscribe: () => noop,
    getSnapshot: () => snapshot,
    start: () => noop,
  };
}

function staticParse(text: string, detect: LevelDetector | false): AnsiLines {
  const parse = parseAnsi(text);
  let tracker: LevelTracker | null = null;
  if (detect) {
    tracker = createLevelTracker(detect);
    tracker.push(parse.lines, 0, parse.lines.length);
  }
  return {
    ...parse,
    done: true,
    version: 0,
    parsed: 1,
    levels: tracker?.levels ?? null,
    levelCounts: tracker?.counts ?? null,
  };
}

function slicedStore(text: string, detect: LevelDetector | false): LinesStore {
  const parser: AnsiParser = createAnsiParser();
  const tracker = detect ? createLevelTracker(detect) : null;
  const listeners = new Set<() => void>();
  let offset = 0;
  let version = 0;
  // Each start gets a token, so a tick queued before a stop is ignored even if
  // the store is started again (StrictMode mounts effects twice).
  let token = 0;

  function take(done: boolean): AnsiLines {
    return {
      lines: parser.lines,
      styles: parser.styles,
      maxCells: parser.maxCells,
      done,
      version: version++,
      parsed: Math.min(1, offset / text.length),
      levels: tracker?.levels ?? null,
      levelCounts: tracker?.counts ?? null,
    };
  }

  function classify() {
    tracker?.push(parser.lines, tracker.count, parser.lines.length);
  }

  function step(): boolean {
    const deadline = performance.now() + SLICE_BUDGET_MS;
    do {
      parser.push(text.slice(offset, offset + SLICE));
      offset += SLICE;
      if (offset >= text.length) {
        parser.end();
        classify();
        return true;
      }
      classify();
    } while (performance.now() < deadline);
    return false;
  }

  // The first batch runs at once so the first paint already has lines.
  let snapshot = take(step());

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    start() {
      if (snapshot.done) return noop;
      const mine = ++token;
      const channel = new MessageChannel();
      const port = channel.port2;
      const close = () => {
        channel.port1.close();
        port.close();
      };
      channel.port1.onmessage = () => {
        if (mine !== token) return;
        const done = step();
        snapshot = take(done);
        for (const listener of listeners) listener();
        if (done) close();
        else port.postMessage(null);
      };
      port.postMessage(null);
      return () => {
        if (mine === token) token++;
        close();
      };
    },
  };
}

/**
 * The parsed lines of `text`. A text over {@link SYNC_PARSE_MAX} is parsed in
 * time slices, and the lines so far are returned with `done` false.
 *
 * With a `levels` detector, each line is classified as it is parsed. A new
 * detector restarts the parse, so it should be stable across renders.
 */
export function useAnsiLines(
  text: string,
  levels: LevelDetector | false = false,
): AnsiLines {
  const store = useMemo(
    () =>
      text.length > SYNC_PARSE_MAX
        ? slicedStore(text, levels)
        : staticStore(staticParse(text, levels)),
    [text, levels],
  );
  useEffect(() => store.start(), [store]);
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}
