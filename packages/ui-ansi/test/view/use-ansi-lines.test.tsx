import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLevelTracker } from "../../src/parse/level-tracker.ts";
import { detectLevel, type LevelDetector } from "../../src/parse/levels.ts";
import { parseAnsi } from "../../src/parse/parser.ts";
import { SYNC_PARSE_MAX, useAnsiLines } from "../../src/view/use-ansi-lines.ts";
import { LOG_SAMPLE } from "../parse/log-sample.ts";

// Ticks queue here and run only when a test flushes them, so a test can stop
// a parse midway.
let queue: Array<() => void> = [];

class StubChannel {
  private closed = false;
  readonly port1 = {
    onmessage: null as ((event: unknown) => void) | null,
    close: () => {
      this.closed = true;
    },
  };
  readonly port2 = {
    postMessage: () => {
      queue.push(() => {
        if (!this.closed) this.port1.onmessage?.({});
      });
    },
    close: () => {
      this.closed = true;
    },
  };
}

function flush(limit = Number.POSITIVE_INFINITY): number {
  let ran = 0;
  while (queue.length > 0 && ran < limit) {
    const tick = queue.shift() as () => void;
    act(tick);
    ran++;
  }
  return ran;
}

let clock = 0;

beforeEach(() => {
  queue = [];
  vi.stubGlobal("MessageChannel", StubChannel);
  // Every reading moves 10 ms on, past the 8 ms budget, so each tick parses
  // exactly one slice.
  vi.spyOn(performance, "now").mockImplementation(() => {
    clock += 10;
    return clock;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function fixture(bytes: number, seed: string): string {
  const parts: string[] = [];
  let size = 0;
  for (let i = 0; size < bytes; i++) {
    const part =
      i % 7 === 0
        ? `\x1b[1;3${i % 8}m${seed} ${i}\x1b[0m progress\r\x1b[38;2;${i % 256};40;80mdone 中文 ${i}\x1b[m\n`
        : i % 11 === 0
          ? `\x1b]8;;https://example.com/${i}\x07link ${i}\x1b]8;;\x07\ttail\n`
          : `${seed} plain line ${i} \x1b[4:3;58;5;${i % 256}mwavy\x1b[24m\n`;
    parts.push(part);
    size += part.length;
  }
  return parts.join("");
}

const BIG = fixture(3 * 1024 * 1024, "first");

// The mockup's sample over and over, some of it ANSI-coloured, so slices cut
// stack traces and escapes at every kind of place.
function logFixture(bytes: number): string {
  const parts: string[] = [];
  let size = 0;
  for (let i = 0; size < bytes; i++) {
    const [line] = LOG_SAMPLE[i % LOG_SAMPLE.length];
    const part = i % 13 === 0 ? `\x1b[33m${line}\x1b[0m\n` : `${line}\n`;
    parts.push(part);
    size += part.length;
  }
  return parts.join("");
}

const LOG = logFixture(3 * 1024 * 1024);

function oneShot(text: string, detect: LevelDetector = detectLevel) {
  const { lines } = parseAnsi(text);
  const tracker = createLevelTracker(detect);
  tracker.push(lines, 0, lines.length);
  return tracker;
}

describe("useAnsiLines", () => {
  it("parses a small text at once", () => {
    const text = "\x1b[31mred\x1b[0m\nplain";
    const { result } = renderHook(() => useAnsiLines(text));
    const expected = parseAnsi(text);
    expect(result.current.done).toBe(true);
    expect(result.current.lines).toEqual(expected.lines);
    expect(result.current.styles).toEqual(expected.styles);
    expect(result.current.maxCells).toBe(expected.maxCells);
    expect(queue).toHaveLength(0);
  });

  it("parses a large text in slices, ending with the whole parse", () => {
    expect(BIG.length).toBeGreaterThan(SYNC_PARSE_MAX);
    const { result } = renderHook(() => useAnsiLines(BIG));
    expect(result.current.done).toBe(false);
    const firstCount = result.current.lines.length;
    expect(firstCount).toBeGreaterThan(0);

    flush(1);
    expect(result.current.done).toBe(false);
    expect(result.current.lines.length).toBeGreaterThan(firstCount);

    const ticks = flush();
    expect(ticks).toBeGreaterThan(40);
    expect(result.current.done).toBe(true);
    const expected = parseAnsi(BIG);
    expect(result.current.lines.length).toBe(expected.lines.length);
    expect(result.current.lines).toEqual(expected.lines);
    expect(result.current.styles).toEqual(expected.styles);
    expect(result.current.maxCells).toBe(expected.maxCells);
  }, 20_000);

  it("keeps the snapshot object between publishes", () => {
    const { result, rerender } = renderHook(() => useAnsiLines(BIG));
    const before = result.current;
    rerender();
    expect(result.current).toBe(before);
    flush(1);
    expect(result.current).not.toBe(before);
    expect(result.current.version).toBeGreaterThan(before.version);
  });

  it("stops parsing on unmount", () => {
    const { result, unmount } = renderHook(() => useAnsiLines(BIG));
    flush(2);
    const seen = result.current;
    unmount();
    const now = vi.mocked(performance.now);
    const calls = now.mock.calls.length;
    flush();
    expect(now.mock.calls.length).toBe(calls);
    expect(result.current).toBe(seen);
    expect(seen.done).toBe(false);
  });

  it("restarts on a new text and drops the old parse", () => {
    const second = fixture(2 * 1024 * 1024, "second");
    const { result, rerender } = renderHook(({ text }) => useAnsiLines(text), {
      initialProps: { text: BIG },
    });
    flush(2);
    rerender({ text: second });
    expect(result.current.done).toBe(false);
    flush();
    const expected = parseAnsi(second);
    expect(result.current.done).toBe(true);
    expect(result.current.lines).toEqual(expected.lines);
  });

  it("switches from a large text to a small one synchronously", () => {
    const { result, rerender } = renderHook(({ text }) => useAnsiLines(text), {
      initialProps: { text: BIG },
    });
    rerender({ text: "short" });
    expect(result.current.done).toBe(true);
    expect(result.current.lines.map((line) => line.text)).toEqual(["short"]);
    flush();
    expect(result.current.lines.map((line) => line.text)).toEqual(["short"]);
  });
});

describe("useAnsiLines with levels", () => {
  it("leaves levels null when they are off", () => {
    const small = renderHook(() => useAnsiLines("ERROR boom"));
    expect(small.result.current.levels).toBeNull();
    expect(small.result.current.levelCounts).toBeNull();

    const big = renderHook(() => useAnsiLines(LOG, false));
    flush();
    expect(big.result.current.done).toBe(true);
    expect(big.result.current.levels).toBeNull();
    expect(big.result.current.levelCounts).toBeNull();
  });

  it("classifies a small text with the parse", () => {
    const text = LOG_SAMPLE.map(([line]) => line).join("\n");
    const { result } = renderHook(() => useAnsiLines(text, detectLevel));
    const expected = oneShot(text);
    expect(result.current.levels).toEqual(expected.levels);
    expect(result.current.levelCounts).toEqual(expected.counts);
    expect(result.current.levels?.length).toBe(result.current.lines.length);
  });

  it("classifies a large text slice by slice, ending as one pass does", () => {
    expect(LOG.length).toBeGreaterThan(SYNC_PARSE_MAX);
    const { result } = renderHook(() => useAnsiLines(LOG, detectLevel));
    let previous = 0;
    for (;;) {
      const snapshot = result.current;
      expect(snapshot.levels?.length).toBe(snapshot.lines.length);
      const counts = snapshot.levelCounts;
      if (!counts) throw new Error("levelCounts missing");
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      expect(total).toBe(snapshot.lines.length);
      expect(snapshot.lines.length).toBeGreaterThanOrEqual(previous);
      previous = snapshot.lines.length;
      if (snapshot.done) break;
      expect(flush(1)).toBe(1);
    }
    const expected = oneShot(LOG);
    expect(result.current.levels).toEqual(expected.levels);
    expect(result.current.levelCounts).toEqual(expected.counts);
    expect(expected.counts.error).toBeGreaterThan(0);
    expect(expected.levels.some((code) => code & 0x80)).toBe(true);
  }, 20_000);

  it("classifies the last line, flushed by end()", () => {
    const text = `${LOG}WARN no newline at the end`;
    const { result } = renderHook(() => useAnsiLines(text, detectLevel));
    flush();
    const levels = result.current.levels;
    expect(levels?.length).toBe(result.current.lines.length);
    expect(levels?.[levels.length - 1]).toBe(3);
  }, 20_000);

  it("restarts the parse when the detector changes", () => {
    const allTrace: LevelDetector = () => ({ level: "trace" });
    const { result, rerender } = renderHook(
      ({ detect }) => useAnsiLines(LOG, detect),
      { initialProps: { detect: detectLevel as LevelDetector } },
    );
    flush(2);
    rerender({ detect: allTrace });
    expect(result.current.done).toBe(false);
    flush();
    expect(result.current.done).toBe(true);
    expect(result.current.levelCounts?.trace).toBe(result.current.lines.length);
    expect(result.current.levels).toEqual(oneShot(LOG, allTrace).levels);
  }, 20_000);
});
