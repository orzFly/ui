import { describe, expect, it } from "vitest";

import {
  MAX_SPACER_PX,
  scrollFromTopRow,
  scrollGeometry,
  topRowFromScroll,
} from "../src/scroll-map.ts";

describe("scroll-map", () => {
  it("maps one pixel to one pixel below the cap", () => {
    const g = scrollGeometry(1000, 20, 200);
    expect(g.scaled).toBe(false);
    expect(g.spacerHeight).toBe(20_000);
    expect(g.maxTopRow).toBe(990);
    expect(scrollFromTopRow(12.5, g)).toBe(250);
    expect(topRowFromScroll(250, g)).toBe(12.5);
    expect(topRowFromScroll(g.spacerHeight - 200, g)).toBe(990);
  });

  it("switches to scaled exactly above the cap", () => {
    expect(scrollGeometry(MAX_SPACER_PX / 20, 20, 200).scaled).toBe(false);
    expect(scrollGeometry(MAX_SPACER_PX / 20 + 1, 20, 200).scaled).toBe(true);
  });

  it("round-trips within one row when scaled", () => {
    const g = scrollGeometry((4 * 2 ** 30) / 16, 22, 440);
    expect(g.scaled).toBe(true);
    expect(g.spacerHeight).toBe(MAX_SPACER_PX);
    for (const row of [0, 1, 12_345, 1e6, 1e8, g.maxTopRow - 1, g.maxTopRow]) {
      const back = topRowFromScroll(scrollFromTopRow(row, g), g);
      expect(Math.abs(back - row)).toBeLessThan(1);
    }
  });

  it("reaches the last row at the maximum scrollTop", () => {
    const g = scrollGeometry(10_000_000, 22, 440);
    expect(topRowFromScroll(MAX_SPACER_PX - 440, g)).toBe(g.maxTopRow);
    expect(topRowFromScroll(MAX_SPACER_PX * 2, g)).toBe(g.maxTopRow);
    expect(g.maxTopRow).toBe(10_000_000 - 20);
  });

  it("stays finite and monotonic for 2**40 bytes", () => {
    const g = scrollGeometry(2 ** 40 / 16, 22, 440);
    let last = -1;
    for (let top = 0; top <= MAX_SPACER_PX; top += 250_000) {
      const row = topRowFromScroll(top, g);
      expect(Number.isFinite(row)).toBe(true);
      expect(row).toBeGreaterThanOrEqual(last);
      last = row;
    }
  });

  it("gives maxTopRow 0 when the viewport is taller than the content", () => {
    const g = scrollGeometry(3, 20, 200);
    expect(g.maxTopRow).toBe(0);
    expect(topRowFromScroll(50, g)).toBe(0);
    expect(scrollFromTopRow(2, g)).toBe(0);
  });
});
