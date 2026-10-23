import { describe, expect, it } from "vitest";

import { LEVELS } from "../../src/parse/levels.ts";

import {
  appendShownLines,
  buildShownLines,
  levelMask,
} from "../../src/view/shown-lines.ts";

// Codes: 0 Other, 1 fatal, 2 error, 3 warn, 4 info, 5 debug, 6 trace; 0x80 inherited.
const levels = Uint8Array.from([4, 2, 2 | 0x80, 0, 5, 3, 6, 1, 4, 0x80]);

function ids(shown: Uint32Array | null): number[] | null {
  return shown && [...shown];
}

function randomLevels(n: number): Uint8Array {
  let seed = 11;
  return Uint8Array.from({ length: n }, () => {
    seed = (seed * 16807) % 2147483647;
    return seed % 5 === 0 ? (seed % 7) | 0x80 : seed % 7;
  });
}

describe("levelMask", () => {
  it("shows every level when nothing is hidden", () => {
    expect(levelMask(new Set())).toBe(0x7f);
  });

  it("clears the bit of each hidden level, Other at bit 0", () => {
    expect(levelMask(new Set(["other"]))).toBe(0x7e);
    expect(levelMask(new Set(["debug", "trace"]))).toBe(0x1f);
    expect(levelMask(new Set(["fatal", "error", "warn"]))).toBe(0x71);
  });

  it("is 0 when every level is hidden", () => {
    const all = [...LEVELS, "other"] as const;
    expect(levelMask(new Set(all))).toBe(0);
  });

  it("rejects names that are not levels", () => {
    // @ts-expect-error "verbose" is not a level
    levelMask(new Set(["verbose"]));
  });
});

describe("buildShownLines", () => {
  it("is null when the mask shows everything and nothing is searched", () => {
    expect(buildShownLines(levels.length, levels, 0x7f, null)).toBeNull();
    expect(buildShownLines(3, null, 0x7f, null)).toBeNull();
  });

  it("keeps the lines whose level the mask shows", () => {
    const mask = levelMask(new Set(["info", "other"]));
    expect(ids(buildShownLines(10, levels, mask, null))).toEqual([
      1, 2, 4, 5, 6, 7,
    ]);
  });

  it("files an inherited level under the level it carries", () => {
    const errors = levelMask(
      new Set(["fatal", "warn", "info", "debug", "trace", "other"]),
    );
    expect(ids(buildShownLines(10, levels, errors, null))).toEqual([1, 2]);
    const other = levelMask(
      new Set(["fatal", "error", "warn", "info", "debug", "trace"]),
    );
    expect(ids(buildShownLines(10, levels, other, null))).toEqual([3, 9]);
  });

  it("treats every line as Other without levels", () => {
    expect(ids(buildShownLines(3, null, 0x01, null))).toEqual([0, 1, 2]);
    expect(ids(buildShownLines(3, null, 0x7e, null))).toEqual([]);
  });

  it("keeps only matching lines when given match flags", () => {
    const matches = Uint8Array.from([1, 0, 1, 1, 0, 0, 0, 1, 1, 0]);
    expect(ids(buildShownLines(10, levels, 0x7f, matches))).toEqual([
      0, 2, 3, 7, 8,
    ]);
  });

  it("requires both a shown level and a match", () => {
    const matches = Uint8Array.from([1, 0, 1, 1, 0, 0, 0, 1, 1, 0]);
    const mask = levelMask(new Set(["info"]));
    expect(ids(buildShownLines(10, levels, mask, matches))).toEqual([2, 3, 7]);
  });

  it("is empty, not null, when the filter hides everything", () => {
    expect(ids(buildShownLines(10, levels, 0, null))).toEqual([]);
  });

  it("leaves out lines the match flags do not reach yet", () => {
    const matches = Uint8Array.from([1, 1]);
    expect(ids(buildShownLines(4, null, 0x7f, matches))).toEqual([0, 1]);
  });

  it("builds over a million lines quickly", () => {
    const lv = randomLevels(1_000_000);
    const mask = levelMask(new Set(["debug", "trace"]));
    buildShownLines(lv.length, lv, mask, null);
    const start = performance.now();
    const shown = buildShownLines(lv.length, lv, mask, null);
    expect(performance.now() - start).toBeLessThan(100);
    expect(shown?.length).toBeGreaterThan(500_000);
  });
});

describe("appendShownLines", () => {
  it("equals a rebuild however the lines are sliced", () => {
    const n = 500;
    const lv = randomLevels(n);
    const matches = Uint8Array.from({ length: n }, (_, i) => (i % 3 ? 0 : 1));
    for (const mask of [0x7e, levelMask(new Set(["debug", "trace"])), 0x04]) {
      for (const flags of [null, matches]) {
        const whole = ids(buildShownLines(n, lv, mask, flags));
        for (const step of [1, 7, 64, 499]) {
          let shown = buildShownLines(0, lv, mask, flags);
          for (let from = 0; from < n; from += step) {
            const prev = shown;
            const before = ids(prev);
            const to = Math.min(n, from + step);
            shown = appendShownLines(prev, from, to, lv, mask, flags);
            // The earlier list still reads as it did.
            expect(ids(prev)).toEqual(before);
          }
          expect(ids(shown)).toEqual(whole);
        }
      }
    }
  });

  it("stays null while nothing is filtered", () => {
    expect(appendShownLines(null, 0, 10, levels, 0x7f, null)).toBeNull();
  });

  it("grows its buffer geometrically rather than on every append", () => {
    let shown = buildShownLines(0, null, 0x01, null);
    const buffers = new Set<ArrayBufferLike>();
    for (let from = 0; from < 10_000; from += 10) {
      shown = appendShownLines(shown, from, from + 10, null, 0x01, null);
      if (shown) buffers.add(shown.buffer);
    }
    expect(shown?.length).toBe(10_000);
    expect(shown?.[9_999]).toBe(9_999);
    expect(buffers.size).toBeLessThan(15);
  });
});
