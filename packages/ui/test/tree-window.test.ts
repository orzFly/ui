import { describe, expect, it } from "vitest";
import {
  maxPins,
  mountedSegments,
  pinnedRows,
  revealTop,
  subtreeEnd,
  type TreePinSource,
  windowRange,
} from "../src/lib/tree-window.ts";

/**
 * Rows from a line of `<level><kind>` words: `b` an open branch, `c` a closed
 * one, `l` a leaf, `x` a loading row.
 */
const rowsOf = (spec: string): TreePinSource[] =>
  spec.split(" ").map((word) => {
    const level = Number(word.slice(0, -1));
    const kind = word.at(-1);
    return kind === "x"
      ? { kind: "loading", level }
      : { kind: "item", level, expanded: kind === "b" };
  });

// 0 a            11 b
// 1   a1         12–19 b's eight leaves
// 2     a1x      20 c (a leaf root)
// 3–5     three leaves
// 6     a1y
// 7   a2
// 8   a3
// 9–10  two leaves
const ROWS = rowsOf(
  "1b 2b 3b 4l 4l 4l 3l 2l 2b 3l 3l 1b 2l 2l 2l 2l 2l 2l 2l 2l 1l",
);
const H = 10;
const at = (top: number, height = 100) => ({ top, height });

describe("windowRange", () => {
  it("starts at the first row while the tree is below the viewport's top", () => {
    expect(windowRange(1000, H, at(-50))).toEqual({ start: 0, end: 15 });
  });

  it("takes the rows on screen and the overscan each way", () => {
    expect(windowRange(1000, H, at(500))).toEqual({ start: 40, end: 70 });
  });

  it("clamps the overscan to the last row", () => {
    expect(windowRange(1000, H, at(9950))).toEqual({ start: 985, end: 1000 });
  });

  it("keeps the overscan around an empty viewport", () => {
    expect(windowRange(1000, H, at(500, 0))).toEqual({ start: 40, end: 60 });
  });

  it("is empty with no rows", () => {
    expect(windowRange(0, H, at(0))).toEqual({ start: 0, end: 0 });
  });
});

describe("mountedSegments", () => {
  it("adds the kept rows to the window, in order, with the gaps between", () => {
    expect(
      mountedSegments(100, { start: 20, end: 30 }, [5, 50, 25, 5, 30, 200, -1]),
    ).toEqual([
      { kind: "gap", rows: 5 },
      { kind: "rows", start: 5, end: 6 },
      { kind: "gap", rows: 14 },
      // 25 is inside, 30 touches the window's end.
      { kind: "rows", start: 20, end: 31 },
      { kind: "gap", rows: 19 },
      { kind: "rows", start: 50, end: 51 },
      { kind: "gap", rows: 49 },
    ]);
  });

  it("leaves out a gap at an end the window reaches", () => {
    expect(mountedSegments(10, { start: 0, end: 10 }, [3])).toEqual([
      { kind: "rows", start: 0, end: 10 },
    ]);
    expect(mountedSegments(10, { start: 4, end: 10 }, [])).toEqual([
      { kind: "gap", rows: 4 },
      { kind: "rows", start: 4, end: 10 },
    ]);
  });

  it("is a gap alone around an empty window, and nothing with no rows", () => {
    expect(mountedSegments(10, { start: 3, end: 3 }, [])).toEqual([
      { kind: "gap", rows: 10 },
    ]);
    expect(mountedSegments(0, { start: 0, end: 0 }, [0])).toEqual([]);
  });
});

describe("subtreeEnd", () => {
  it("is the row itself for a leaf and a closed branch", () => {
    expect(subtreeEnd(ROWS, 3)).toBe(3);
    expect(subtreeEnd(rowsOf("1c 1l"), 0)).toBe(0);
  });

  it("is the last row under an open branch", () => {
    expect(subtreeEnd(ROWS, 0)).toBe(10);
    expect(subtreeEnd(ROWS, 1)).toBe(6);
    expect(subtreeEnd(ROWS, 2)).toBe(5);
    expect(subtreeEnd(ROWS, 8)).toBe(10);
  });

  it("runs to the end under the last root", () => {
    expect(subtreeEnd(ROWS, 11)).toBe(19);
    expect(subtreeEnd(rowsOf("1l 1b 2l 2l"), 1)).toBe(3);
  });

  it("counts a loading row as the branch's", () => {
    expect(subtreeEnd(rowsOf("1b 2b 3x 1l"), 1)).toBe(2);
    expect(subtreeEnd(rowsOf("1b 2b 3x 1l"), 0)).toBe(2);
  });
});

describe("pinnedRows", () => {
  const pins = (top: number, max = 5, rows = ROWS) =>
    pinnedRows(rows, H, at(top), max);

  it("pins nothing until the tree scrolls under the viewport's top", () => {
    expect(pins(0)).toEqual([]);
    expect(pins(-30)).toEqual([]);
  });

  it("pins one open branch per level down to the slot's row", () => {
    expect(pins(5)).toEqual([
      { index: 0, top: 0 },
      { index: 1, top: 10 },
      { index: 2, top: 20 },
    ]);
    expect(pins(85)).toEqual([
      { index: 0, top: 0 },
      { index: 8, top: 10 },
    ]);
  });

  it("pushes the deepest out as its subtree's last row passes", () => {
    expect(pins(35)).toEqual([
      { index: 0, top: 0 },
      { index: 1, top: 10 },
      { index: 2, top: 15 },
    ]);
    expect(pins(105)).toEqual([{ index: 0, top: -5 }]);
  });

  it("drops a branch once its subtree has scrolled past", () => {
    expect(pins(40)).toEqual([
      { index: 0, top: 0 },
      { index: 1, top: 10 },
    ]);
    expect(pins(110)).toEqual([{ index: 11, top: 0 }]);
  });

  it("keeps the outer pins when only so many fit", () => {
    expect(pins(5, 2)).toEqual([
      { index: 0, top: 0 },
      { index: 1, top: 10 },
    ]);
    expect(pins(5, 0)).toEqual([]);
  });

  it("never pins a leaf, a closed branch or a loading row", () => {
    expect(pins(5, 5, rowsOf("1c 1l 1l 1l"))).toEqual([]);
    expect(pins(15, 5, rowsOf("1b 2x 2l 2l 2l 1l"))).toEqual([
      { index: 0, top: 0 },
    ]);
  });
});

describe("maxPins", () => {
  it("fits whole rows into half the viewport", () => {
    expect(maxPins(10, 100)).toBe(5);
    expect(maxPins(10, 95)).toBe(4);
    expect(maxPins(10, 0)).toBe(0);
    expect(maxPins(0, 100)).toBe(0);
  });
});

describe("revealTop", () => {
  const view = { top: 100, height: 50 };

  it("leaves a row in sight where it is with nearest", () => {
    expect(revealTop(12, H, view, 0, "nearest")).toBeUndefined();
    expect(revealTop(14, H, view, 0, "nearest")).toBeUndefined();
  });

  it("brings a row above or below to the nearer edge", () => {
    expect(revealTop(5, H, view, 0, "nearest")).toBe(50);
    expect(revealTop(20, H, view, 0, "nearest")).toBe(160);
  });

  it("keeps a row clear of the pins", () => {
    expect(revealTop(11, H, view, 20, "nearest")).toBe(90);
    expect(revealTop(12, H, view, 20, "nearest")).toBeUndefined();
  });

  it("puts a row at the top, or in the middle, of the room below the pins", () => {
    expect(revealTop(20, H, view, 0, "start")).toBe(200);
    expect(revealTop(20, H, view, 20, "start")).toBe(180);
    expect(revealTop(20, H, view, 0, "center")).toBe(180);
    expect(revealTop(20, H, view, 20, "center")).toBe(170);
  });
});
