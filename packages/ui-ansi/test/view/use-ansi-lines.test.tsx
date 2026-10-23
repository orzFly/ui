import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseAnsi } from "../../src/parse/parser.ts";
import { SYNC_PARSE_MAX, useAnsiLines } from "../../src/view/use-ansi-lines.ts";

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
  });

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
