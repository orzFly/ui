import { describe, expect, it } from "vitest";
import { roundedEdgePadding } from "../src/lib/collision-padding.ts";

// Floating UI's rounding of the transform at a device pixel ratio, for
// checking where a surface's edges land once it is drawn.
const roundByDpr = (value: number, dpr: number) =>
  Math.round(value * dpr) / dpr;

describe("roundedEdgePadding", () => {
  it("adds half a pixel to the far sides only", () => {
    expect(roundedEdgePadding(8)).toEqual({
      top: 8,
      right: 8.5,
      bottom: 8.5,
      left: 8,
    });
  });

  it("keeps a side the caller left out at Radix's 0 and still adds to it", () => {
    expect(roundedEdgePadding({ top: 16 })).toEqual({
      top: 16,
      right: 0.5,
      bottom: 0.5,
    });
  });

  // UI-291: a capped surface opening down from a trigger whose bottom edge is
  // fractional, in a 520px viewport. The size middleware gives it the room
  // below its unrounded y; the transform then carries it down by the rounding.
  it("keeps a capped surface's bottom inside the padding at any rounding", () => {
    const viewport = 520;
    for (const dpr of [1, 1.25, 1.5, 1.75, 2, 3]) {
      for (let f = 0; f < 1; f += 1 / 16) {
        const y = 259 + f;
        const { bottom = 0 } = roundedEdgePadding(8);
        const available = viewport - bottom - y;
        expect(roundByDpr(y, dpr) + available).toBeLessThanOrEqual(
          viewport - 8,
        );
      }
    }
  });
});
