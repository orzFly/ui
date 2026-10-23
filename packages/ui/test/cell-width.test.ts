import { describe, expect, it } from "vitest";
import { cellWidth } from "../src/lib/cell-width.ts";
import { WIDE } from "../src/lib/cell-width-table.ts";

const cp = (s: string) => s.codePointAt(0) ?? 0;

describe("cellWidth", () => {
  it.each(["A", "z", " ", "~", "é", "ß", "ÿ", "Ā", "Ω", "Я"])(
    "gives %s one cell",
    (s) => {
      expect(cellWidth(cp(s))).toBe(1);
    },
  );

  it.each([
    ["中", 0x4e2d],
    ["ア", 0x30a2],
    ["한", 0xd55c],
    ["Ａ", 0xff21],
    ["ideographic space", 0x3000],
    ["U+20000", 0x20000],
    ["😀", 0x1f600],
  ])("gives %s two cells", (_, code) => {
    expect(cellWidth(code)).toBe(2);
  });

  it.each([
    ["combining acute", 0x301],
    ["ZWJ", 0x200d],
    ["VS16", 0xfe0f],
    ["VS1", 0xfe00],
    ["VS17", 0xe0100],
    ["enclosing circle", 0x20dd],
  ])("gives %s no cells", (_, code) => {
    expect(cellWidth(code)).toBe(0);
  });

  it("gives the code points just outside a wide range one cell", () => {
    expect(cellWidth(0x10ff)).toBe(1);
    expect(cellWidth(0x1100)).toBe(2);
    expect(cellWidth(0x115f)).toBe(2);
    expect(cellWidth(0x1160)).toBe(1);
    expect(cellWidth(0xff60)).toBe(2);
    expect(cellWidth(0xff61)).toBe(1);
    expect(cellWidth(0xd7a3)).toBe(2);
    expect(cellWidth(0xd7a4)).toBe(1);
  });

  it("checks every range edge against the table", () => {
    for (let i = 0; i < WIDE.length; i += 2) {
      for (const code of [WIDE[i], WIDE[i + 1]]) {
        expect(cellWidth(code), code.toString(16)).not.toBe(1);
      }
    }
  });
});

describe("WIDE", () => {
  it("is sorted, inclusive pairs with no overlaps or adjacency", () => {
    expect(WIDE.length % 2).toBe(0);
    for (let i = 0; i < WIDE.length; i += 2) {
      expect(WIDE[i]).toBeLessThanOrEqual(WIDE[i + 1]);
      if (i > 0) expect(WIDE[i]).toBeGreaterThan(WIDE[i - 1] + 1);
    }
  });
});
