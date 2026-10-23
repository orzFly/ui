import { describe, expect, it } from "vitest";

import { PALETTE_NAMES, xterm256 } from "../../src/parse/index.ts";

describe("PALETTE_NAMES", () => {
  it("names the 16 theme colours in order", () => {
    expect(PALETTE_NAMES).toHaveLength(16);
    expect(PALETTE_NAMES[0]).toBe("black");
    expect(PALETTE_NAMES[7]).toBe("white");
    expect(PALETTE_NAMES[8]).toBe("bright-black");
    expect(PALETTE_NAMES[15]).toBe("bright-white");
  });
});

describe("xterm256", () => {
  it("maps 16–231 to the 6×6×6 cube", () => {
    expect(xterm256(16)).toEqual({ r: 0, g: 0, b: 0 });
    expect(xterm256(17)).toEqual({ r: 0, g: 0, b: 95 });
    expect(xterm256(21)).toEqual({ r: 0, g: 0, b: 255 });
    expect(xterm256(22)).toEqual({ r: 0, g: 95, b: 0 });
    expect(xterm256(196)).toEqual({ r: 255, g: 0, b: 0 });
    expect(xterm256(208)).toEqual({ r: 255, g: 135, b: 0 });
    expect(xterm256(231)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("maps 232–255 to greys", () => {
    expect(xterm256(232)).toEqual({ r: 8, g: 8, b: 8 });
    expect(xterm256(244)).toEqual({ r: 128, g: 128, b: 128 });
    expect(xterm256(255)).toEqual({ r: 238, g: 238, b: 238 });
  });

  it("refuses the theme's colours and values out of range", () => {
    for (const n of [0, 15, 256, -1, 16.5]) {
      expect(() => xterm256(n)).toThrow(RangeError);
    }
  });
});
