import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnsiLine } from "../../src/parse/types.ts";
import { appendShownLines } from "../../src/view/shown-lines.ts";
import {
  SEARCH_DEBOUNCE_MS,
  type SearchInput,
  useSearch,
} from "../../src/view/use-search.ts";

// Ticks queue here and run only when a test flushes them, so a test can stop
// a scan midway.
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

function wait(ms = SEARCH_DEBOUNCE_MS): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

let clock = 0;

beforeEach(() => {
  queue = [];
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("MessageChannel", StubChannel);
  // Every reading moves 10 ms on, past the 8 ms budget, so each tick scans
  // exactly one chunk of lines.
  vi.spyOn(performance, "now").mockImplementation(() => {
    clock += 10;
    return clock;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function line(i: number): AnsiLine {
  const text =
    i % 10 === 0
      ? `ERROR request ${i} failed on app.example`
      : `INFO request ${i} served by host-one`;
  return { text, runs: Uint32Array.of(0, 0), cells: text.length };
}

const LINES = Array.from({ length: 2000 }, (_, i) => line(i));

function input(overrides: Partial<SearchInput> = {}): SearchInput {
  return {
    query: "",
    caseSensitive: false,
    regex: false,
    lines: LINES,
    count: LINES.length,
    done: true,
    shown: null,
    ...overrides,
  };
}

function setup(initial: SearchInput) {
  return renderHook((props: SearchInput) => useSearch(props), {
    initialProps: initial,
  });
}

function matchedIds(matches: Uint32Array): number[] {
  const ids: number[] = [];
  for (let i = 0; i < matches.length; i += 3) ids.push(matches[i]);
  return ids;
}

const ERROR_IDS = LINES.map((_, i) => i).filter((i) => i % 10 === 0);

describe("useSearch", () => {
  it("does nothing for an empty query", () => {
    const { result } = setup(input());
    wait();
    expect(queue).toHaveLength(0);
    expect(result.current.count).toBe(0);
    expect(result.current.scanning).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.matchLines.length).toBeGreaterThanOrEqual(
      LINES.length,
    );
  });

  it("starts 150 ms after the last change, and finds every match", () => {
    const { result, rerender } = setup(input({ query: "err" }));
    expect(result.current.scanning).toBe(true);
    wait(SEARCH_DEBOUNCE_MS - 1);
    rerender(input({ query: "error" }));
    wait(SEARCH_DEBOUNCE_MS - 1);
    expect(queue).toHaveLength(0);
    expect(result.current.count).toBe(0);
    wait(1);
    expect(queue).toHaveLength(1);

    flush();
    expect(result.current.scanning).toBe(false);
    expect(result.current.count).toBe(ERROR_IDS.length);
    expect(result.current.capped).toBe(false);
    expect(matchedIds(result.current.matches)).toEqual(ERROR_IDS);
    expect(Array.from(result.current.matches.subarray(0, 3))).toEqual([
      0, 0, 5,
    ]);
    expect(result.current.matchLines.length).toBeGreaterThanOrEqual(
      LINES.length,
    );
    for (let i = 0; i < LINES.length; i++) {
      expect(result.current.matchLines[i]).toBe(i % 10 === 0 ? 1 : 0);
    }
  });

  it("stays scanning until the scan reaches the last line", () => {
    const { result } = setup(input({ query: "error" }));
    wait();
    flush(2);
    expect(result.current.scanning).toBe(true);
    expect(result.current.count).toBeGreaterThan(0);
    expect(result.current.count).toBeLessThan(ERROR_IDS.length);
    expect(flush()).toBeGreaterThan(2);
    expect(result.current.scanning).toBe(false);
  });

  it("restarts on a new query and drops the old scan", () => {
    const { result, rerender } = setup(input({ query: "error" }));
    wait();
    flush(2);
    rerender(input({ query: "request 1" }));
    // The old results stay up while the new query waits.
    expect(result.current.count).toBeGreaterThan(0);
    expect(result.current.scanning).toBe(true);
    flush();
    expect(queue).toHaveLength(0);
    wait();
    flush();
    const expected = LINES.map((l, i) => [l.text, i] as const)
      .filter(([text]) => /request 1/.test(text))
      .map(([, i]) => i);
    expect(matchedIds(result.current.matches)).toEqual(expected);
  });

  it("restarts when the case flag changes", () => {
    const { result, rerender } = setup(input({ query: "error" }));
    wait();
    flush();
    expect(result.current.count).toBe(ERROR_IDS.length);
    rerender(input({ query: "error", caseSensitive: true }));
    wait();
    flush();
    expect(result.current.count).toBe(0);
    expect(result.current.scanning).toBe(false);
  });

  it("reports an invalid regular expression without scanning", () => {
    const { result } = setup(input({ query: "(", regex: true }));
    wait();
    expect(queue).toHaveLength(0);
    expect(result.current.error).toBe("invalid");
    expect(result.current.scanning).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("clears at once when the query is emptied", () => {
    const { result, rerender } = setup(input({ query: "error" }));
    wait();
    flush(1);
    rerender(input());
    expect(result.current.count).toBe(0);
    expect(result.current.scanning).toBe(false);
    flush();
    expect(result.current.count).toBe(0);
  });

  it("stops scanning on unmount", () => {
    const { result, unmount } = setup(input({ query: "error" }));
    wait();
    flush(1);
    const seen = result.current;
    unmount();
    const now = vi.mocked(performance.now);
    const calls = now.mock.calls.length;
    flush();
    wait();
    expect(now.mock.calls.length).toBe(calls);
    expect(result.current).toBe(seen);
  });

  it("drops a pending start on unmount", () => {
    const { unmount } = setup(input({ query: "error" }));
    unmount();
    wait();
    expect(queue).toHaveLength(0);
  });

  it("scans under StrictMode's double effects", () => {
    const { result } = renderHook(() => useSearch(input({ query: "error" })), {
      wrapper: StrictMode,
    });
    wait();
    flush();
    expect(result.current.count).toBe(ERROR_IDS.length);
  });

  it("scans lines as they arrive while parsing", () => {
    const lines: AnsiLine[] = LINES.slice(0, 300);
    const { result, rerender } = setup(
      input({ query: "error", lines, count: lines.length, done: false }),
    );
    wait();
    flush();
    expect(result.current.count).toBe(30);
    // More lines may come, so the count is not final.
    expect(result.current.scanning).toBe(true);

    lines.push(...LINES.slice(300, 1000));
    rerender(
      input({ query: "error", lines, count: lines.length, done: false }),
    );
    flush();
    expect(result.current.count).toBe(100);
    expect(result.current.scanning).toBe(true);

    lines.push(...LINES.slice(1000));
    rerender(input({ query: "error", lines, count: lines.length, done: true }));
    expect(result.current.scanning).toBe(true);
    flush();
    expect(result.current.scanning).toBe(false);
    expect(matchedIds(result.current.matches)).toEqual(ERROR_IDS);
  });

  it("carries on over ids appended to the shown lines", () => {
    // Few enough matches that the matches buffer never grows, so it keeps its
    // identity unless the scan restarts.
    const levels = new Uint8Array(LINES.length).map((_, i) =>
      i % 200 === 100 ? 3 : 4,
    );
    const mask = 0x7f & ~(1 << 3);
    let shown = appendShownLines(null, 0, 1000, levels, mask, null);
    const lines: AnsiLine[] = LINES.slice(0, 1000);
    const at = (more: Partial<SearchInput>) =>
      input({ query: "00 failed", lines, count: lines.length, shown, ...more });
    const { result, rerender } = setup(at({ done: false }));
    wait();
    flush();
    expect(matchedIds(result.current.matches)).toEqual([200, 400, 600, 800]);
    const buffer = result.current.matches.buffer;

    lines.push(...LINES.slice(1000, 1500));
    shown = appendShownLines(shown, 1000, 1500, levels, mask, null);
    rerender(at({ done: false }));
    flush();
    expect(result.current.count).toBe(7);
    expect(result.current.matches.buffer).toBe(buffer);

    // A copied list with the same prefix also counts as an append.
    lines.push(...LINES.slice(1500));
    shown = appendShownLines(
      Uint32Array.from(shown as Uint32Array),
      1500,
      LINES.length,
      levels,
      mask,
      null,
    );
    rerender(at({ done: true }));
    flush();
    expect(matchedIds(result.current.matches)).toEqual([
      200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800,
    ]);
    expect(result.current.matches.buffer).toBe(buffer);
    expect(result.current.scanning).toBe(false);
  });

  it("restarts at once when the shown lines change otherwise", () => {
    const { result, rerender } = setup(input({ query: "error" }));
    wait();
    flush();
    const buffer = result.current.matches.buffer;
    const shown = Uint32Array.from(ERROR_IDS.filter((i) => i >= 1000));
    rerender(input({ query: "error", shown }));
    expect(result.current.count).toBe(0);
    expect(result.current.scanning).toBe(true);
    flush();
    expect(result.current.matches.buffer).not.toBe(buffer);
    expect(matchedIds(result.current.matches)).toEqual(Array.from(shown));
    expect(result.current.matchLines[0]).toBe(0);
  });

  it("restarts on new lines", () => {
    const { result, rerender } = setup(input({ query: "error" }));
    wait();
    flush();
    const other = [line(10), line(3)];
    rerender(input({ query: "error", lines: other, count: 2 }));
    flush();
    expect(matchedIds(result.current.matches)).toEqual([0]);
  });

  it("drops matches on new lines at once, even while the wait runs", () => {
    const { result, rerender } = setup(input({ query: "request 1" }));
    wait();
    flush();
    expect(result.current.count).toBeGreaterThan(2);
    const other = [line(1), line(12)];
    rerender(input({ query: "request 12", lines: other, count: 2 }));
    expect(result.current.count).toBe(0);
    expect(result.current.scanning).toBe(true);
    wait();
    flush();
    expect(matchedIds(result.current.matches)).toEqual([1]);

    rerender(input({ query: "request", lines: other, count: 2 }));
    expect(result.current.count).toBe(1);
    rerender(input({ query: "request" }));
    expect(result.current.count).toBe(0);
    wait();
    flush();
    expect(result.current.count).toBe(LINES.length);
  });

  it("drops matches on hidden lines at once, even while the wait runs", () => {
    const { result, rerender } = setup(input({ query: "request" }));
    wait();
    flush();
    rerender(input({ query: "request 1" }));
    expect(result.current.count).toBe(LINES.length);
    const shown = Uint32Array.from(ERROR_IDS);
    rerender(input({ query: "request 1", shown }));
    expect(result.current.count).toBe(0);
    expect(result.current.scanning).toBe(true);
    wait();
    flush();
    const ids = matchedIds(result.current.matches);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id % 10 === 0)).toBe(true);
  });

  it("changes the generation when a scan starts over, not as it goes on", () => {
    const lines: AnsiLine[] = LINES.slice(0, 1000);
    const at = (more: Partial<SearchInput>) =>
      input({ lines, count: lines.length, ...more });
    const { result, rerender } = setup(at({ query: "error", done: false }));
    const idle = result.current.generation;
    wait();
    const first = result.current.generation;
    expect(first).not.toBe(idle);
    flush();
    lines.push(...LINES.slice(1000));
    rerender(at({ query: "error", done: true }));
    flush();
    expect(result.current.count).toBe(ERROR_IDS.length);
    expect(result.current.generation).toBe(first);

    // Old matches stay up through the wait, under the old generation.
    rerender(at({ query: "error 1", done: true }));
    expect(result.current.generation).toBe(first);
    wait();
    expect(result.current.generation).not.toBe(first);

    const restarted = result.current.generation;
    rerender(at({ query: "error 1", shown: Uint32Array.of(10, 20) }));
    expect(result.current.generation).not.toBe(restarted);
  });
});
