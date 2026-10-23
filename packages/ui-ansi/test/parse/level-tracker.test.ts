import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createLevelTracker,
  LEVEL_INHERITED,
  type LevelDetector,
  type LogLevel,
  levelCode,
  parseAnsi,
} from "../../src/parse/index.ts";
import { LOG_SAMPLE } from "./log-sample.ts";

type Expected = LogLevel | `^${LogLevel}` | null;

const asLines = (texts: readonly string[]) => texts.map((text) => ({ text }));

function codeOf(expected: Expected): number {
  if (expected === null) return 0;
  if (expected.startsWith("^")) {
    return levelCode(expected.slice(1) as LogLevel) | LEVEL_INHERITED;
  }
  return levelCode(expected as LogLevel);
}

function classify(texts: readonly string[], detect?: LevelDetector) {
  const tracker = createLevelTracker(detect);
  tracker.push(asLines(texts), 0, texts.length);
  return tracker;
}

function expectLevels(rows: readonly [string, Expected][]) {
  const tracker = classify(rows.map(([text]) => text));
  expect([...tracker.levels]).toEqual(rows.map(([, level]) => codeOf(level)));
}

const SAMPLE_LINES = parseAnsi(LOG_SAMPLE.map(([raw]) => raw).join("\n")).lines;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createLevelTracker", () => {
  it("carries an error through a Java trace", () => {
    expectLevels([
      ["2026-10-23 09:14:04.101 ERROR [req-81] request failed", "error"],
      ["java.lang.IllegalStateException: item 7 has no owner", "^error"],
      ["        at com.example.api.Handler.load(Handler.java:88)", "^error"],
      ["        ... 23 more", "^error"],
      ["Caused by: java.sql.SQLException: timeout", "^error"],
      ["\tat com.example.db.Pool.acquire(Pool.java:120)", "^error"],
      ["\tSuppressed: java.io.IOException: closed", "^error"],
      ["Suppressed: java.io.IOException: closed", "^error"],
      ["... 4 more", "^error"],
      ["com.example.Oops$Inner$1Throwable", "^error"],
      ["2026-10-23 09:14:05.000 INFO  [main] recovered", "info"],
    ]);
  });

  it("carries an error through a Python traceback", () => {
    expectLevels([
      ["Traceback (most recent call last):", "error"],
      ['  File "worker.py", line 12, in <module>', "^error"],
      ["    main()", "^error"],
      ["ValueError: no errors expected here", "^error"],
      ["KeyError", "^error"],
      ["Done in 3.2s.", null],
    ]);
  });

  it("ends the chain at a blank line", () => {
    expectLevels([
      ["WARN slow query", "warn"],
      ["  on table items", "^warn"],
      ["", null],
      ["  not part of it", null],
      ["ERROR again", "error"],
      ["   ", null],
      ["  not part of it", null],
      ["ERROR again", "error"],
      ["\t", null],
      ["  not part of it", null],
    ]);
  });

  it("leaves an unindented plain line Other", () => {
    expectLevels([
      ["npm warn deprecated inflight@1.0.6", "warn"],
      ["Done in 3.2s.", null],
      ["  indented after Other", null],
      ["java.lang.IllegalStateException: no level above", null],
      ["WARN retrying", "warn"],
      ["ErrorBoundary rendered", null],
      ["WARN retrying", "warn"],
      ["Caused by nothing", null],
    ]);
  });

  it("lets a line's own level win over continuing", () => {
    expectLevels([
      ["ERROR first", "error"],
      ["  WARN indented, with its own level", "warn"],
      ["  more", "^warn"],
      ["Caused by: ERROR inside", "error"],
    ]);
  });

  it("sets the inherited bit on inherited lines only", () => {
    const tracker = classify(SAMPLE_LINES.map((line) => line.text));
    expect([...tracker.levels].map((code) => code & LEVEL_INHERITED)).toEqual(
      LOG_SAMPLE.map(([, level]) =>
        level?.startsWith("^") ? LEVEL_INHERITED : 0,
      ),
    );
  });

  it("classifies the mockup sample", () => {
    const tracker = classify(SAMPLE_LINES.map((line) => line.text));
    expect(tracker.count).toBe(26);
    expect([...tracker.levels]).toEqual(
      LOG_SAMPLE.map(([, level]) => codeOf(level)),
    );
    expect(tracker.counts).toEqual({
      fatal: 1,
      error: 13,
      warn: 5,
      info: 4,
      debug: 1,
      trace: 1,
      other: 1,
    });
  });

  it("starts empty", () => {
    const tracker = createLevelTracker();
    expect(tracker.count).toBe(0);
    expect(tracker.levels).toHaveLength(0);
    expect(tracker.counts).toEqual({
      fatal: 0,
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
      trace: 0,
      other: 0,
    });
  });

  it("gives levels a view of exactly count lines, past growth", () => {
    const tracker = createLevelTracker();
    const lines = asLines(
      Array.from({ length: 5000 }, (_, i) =>
        i % 3 === 0 ? `ERROR ${i}` : `  at frame ${i}`,
      ),
    );
    for (let from = 0; from < lines.length; from += 700) {
      const to = Math.min(lines.length, from + 700);
      tracker.push(lines, from, to);
      expect(tracker.count).toBe(to);
      expect(tracker.levels).toHaveLength(to);
    }
    expect(tracker.levels[4999]).toBe(levelCode("error") | LEVEL_INHERITED);
    expect(tracker.counts.error).toBe(5000);
  });

  it("publishes a new counts object per push", () => {
    const tracker = createLevelTracker();
    const lines = asLines(["ERROR a", "INFO b"]);
    const before = tracker.counts;
    tracker.push(lines, 0, 1);
    const after = tracker.counts;
    expect(after).not.toBe(before);
    expect(before.error).toBe(0);
    tracker.push(lines, 1, 2);
    expect(after).toMatchObject({ error: 1, info: 0 });
    expect(tracker.counts.info).toBe(1);
  });

  it("refuses a push that does not continue the last", () => {
    const tracker = createLevelTracker();
    const lines = asLines(["a", "b", "c"]);
    tracker.push(lines, 0, 1);
    expect(() => tracker.push(lines, 2, 3)).toThrow(RangeError);
    expect(() => tracker.push(lines, 0, 1)).toThrow(RangeError);
    tracker.push(lines, 1, 1);
    expect(tracker.count).toBe(1);
  });

  it("uses a custom detector", () => {
    const detect: LevelDetector = (text) => {
      const m = /^lvl:(\d)/.exec(text);
      return m ? { level: (["error", "info"] as const)[Number(m[1])] } : null;
    };
    const tracker = classify(
      ["lvl:0 boom", "  frame", "lvl:1 fine", "ERROR not this one", "plain"],
      detect,
    );
    expect([...tracker.levels]).toEqual([
      levelCode("error"),
      levelCode("error") | LEVEL_INHERITED,
      levelCode("info"),
      0,
      0,
    ]);
    expect(tracker.counts).toMatchObject({ error: 2, info: 1, other: 2 });
  });

  it("treats an unknown level from a custom detector as none", () => {
    const tracker = classify(["a", "  b"], () => ({
      level: "loud" as LogLevel,
    }));
    expect([...tracker.levels]).toEqual([0, 0]);
  });

  it("reports a throwing detector once and reads its lines as none", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const tracker = classify(["boom", "  frame", "ok", "boom"], (text) => {
      if (text.startsWith("boom")) throw new Error("bad detector");
      return { level: "warn" };
    });
    expect([...tracker.levels]).toEqual([
      0,
      levelCode("warn"),
      levelCode("warn"),
      0,
    ]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(tracker.counts).toMatchObject({ warn: 2, other: 2 });
  });

  it("gives the same levels and counts wherever the lines are split", () => {
    const whole = classify(SAMPLE_LINES.map((line) => line.text));
    const n = SAMPLE_LINES.length;
    for (let k = 0; k <= n; k++) {
      const tracker = createLevelTracker();
      tracker.push(SAMPLE_LINES, 0, k);
      tracker.push(SAMPLE_LINES, k, n);
      expect([...tracker.levels], `split at ${k}`).toEqual([...whole.levels]);
      expect(tracker.counts, `split at ${k}`).toEqual(whole.counts);
    }
    const oneByOne = createLevelTracker();
    for (let i = 0; i < n; i++) oneByOne.push(SAMPLE_LINES, i, i + 1);
    expect([...oneByOne.levels]).toEqual([...whole.levels]);
    expect(oneByOne.counts).toEqual(whole.counts);
  });
});
