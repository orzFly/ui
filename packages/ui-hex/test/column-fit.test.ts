import { describe, expect, it } from "vitest";

import {
  type ColumnMetrics,
  columnChoices,
  fitColumns,
  rowWidth,
} from "../src/column-fit.ts";

const metrics: ColumnMetrics = {
  fixed: 50,
  column: 30,
  groupGap: 5,
  groupSize: 8,
};

describe("columnChoices", () => {
  it("halves through the powers of two down to 4", () => {
    expect(columnChoices(16)).toEqual([16, 8, 4]);
    expect(columnChoices(32)).toEqual([32, 16, 8, 4]);
    expect(columnChoices(8)).toEqual([8, 4]);
    expect(columnChoices(4)).toEqual([4]);
  });

  it("starts from a maximum that is not a power of two", () => {
    expect(columnChoices(12)).toEqual([12, 8, 4]);
    expect(columnChoices(5)).toEqual([5, 4]);
  });

  it("keeps a maximum under 4 as the only choice", () => {
    expect(columnChoices(3)).toEqual([3]);
    expect(columnChoices(1)).toEqual([1]);
  });
});

describe("rowWidth", () => {
  it("adds a group gap between groups, never after the last", () => {
    expect(rowWidth(8, metrics)).toBe(50 + 8 * 30);
    expect(rowWidth(16, metrics)).toBe(50 + 16 * 30 + 5);
    expect(rowWidth(16, { ...metrics, groupSize: 0 })).toBe(50 + 16 * 30);
  });
});

describe("fitColumns", () => {
  it("picks the widest choice that fits", () => {
    expect(fitColumns(rowWidth(16, metrics), 16, metrics)).toBe(16);
    expect(fitColumns(rowWidth(16, metrics) - 1, 16, metrics)).toBe(8);
    expect(fitColumns(rowWidth(8, metrics), 16, metrics)).toBe(8);
    expect(fitColumns(rowWidth(8, metrics) - 1, 16, metrics)).toBe(4);
  });

  it("allows half a pixel of rounding", () => {
    expect(fitColumns(rowWidth(16, metrics) - 0.4, 16, metrics)).toBe(16);
  });

  it("falls back to the narrowest choice when none fits", () => {
    expect(fitColumns(10, 16, metrics)).toBe(4);
  });
});
