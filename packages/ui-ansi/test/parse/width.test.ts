import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../src/parse/index.ts";

const first = (input: string) => parseAnsi(input).lines[0];
const ACUTE = "\u0301";

describe("cell width", () => {
  it("counts wide characters as two cells", () => {
    expect(first("中文")).toMatchObject({ text: "中文", cells: 4 });
    expect(first("aア한Ａb")?.cells).toBe(8);
    expect(first("\u{1f600}x")).toMatchObject({ text: "\u{1f600}x", cells: 3 });
    expect(first("\u{20000}")?.cells).toBe(2);
  });

  it("counts combining marks, ZWJ and variation selectors as zero", () => {
    expect(first(`e${ACUTE}`)).toMatchObject({ text: `e${ACUTE}`, cells: 1 });
    expect(first("\u2764\ufe0f")?.cells).toBe(1);
    // Code points, not graphemes: a ZWJ sequence counts each of its parts.
    expect(first("\u{1f469}\u200d\u{1f4bb}")?.cells).toBe(4);
  });

  it("keeps a zero-width code point at column 0", () => {
    expect(first(`${ACUTE}a`)).toMatchObject({ text: `${ACUTE}a`, cells: 1 });
  });

  it("attaches a zero-width code point to the previous cell in the cell buffer", () => {
    expect(first(`abc\r\x1b[C${ACUTE}`)).toMatchObject({
      text: `a${ACUTE}bc`,
      cells: 3,
    });
    expect(first(`ab${ACUTE}c\rX`)).toMatchObject({
      text: `Xb${ACUTE}c`,
      cells: 3,
    });
    // Overwriting a cell drops what was attached to it.
    expect(first(`ab${ACUTE}c\r\x1b[CX`).text).toBe("aXc");
  });

  it("attaches to a wide character through its right half", () => {
    expect(first(`中x\r\x1b[2C${ACUTE}`)).toMatchObject({
      text: `中${ACUTE}x`,
      cells: 3,
    });
  });

  it("keeps a zero-width code point with no cell before it in the cell buffer", () => {
    expect(first(`ab\r${ACUTE}`)).toMatchObject({
      text: `${ACUTE}ab`,
      cells: 2,
    });
    expect(first(`${ACUTE}ab\rX`)).toMatchObject({
      text: `${ACUTE}Xb`,
      cells: 2,
    });
  });

  it("gives a zero-width code point the style of the cell it attaches to", () => {
    const style = (input: string) => {
      const { lines, styles } = parseAnsi(input);
      const runs = [...(lines[0]?.runs ?? [])];
      return { text: lines[0]?.text, runs, styles: styles.length };
    };
    const expected = { text: `a${ACUTE}b`, runs: [0, 0, 2, 1], styles: 2 };
    expect(style(`a\x1b[31m${ACUTE}b`)).toEqual(expected);
    // The cell buffer gives the same answer.
    expect(style(`Z\ra\x1b[31m${ACUTE}b`)).toEqual(expected);
  });

  it("measures the widest line for maxCells", () => {
    expect(parseAnsi("ab\n中文中\nabcd").maxCells).toBe(6);
  });

  it("keeps lone surrogates as one cell", () => {
    expect(first("a\ud83db")).toMatchObject({ text: "a\ud83db", cells: 3 });
    expect(first("a\ude00b")).toMatchObject({ text: "a\ude00b", cells: 3 });
    expect(first("a\ud83d")).toMatchObject({ text: "a\ud83d", cells: 2 });
    expect(first("a\ud83db\rX")).toMatchObject({ text: "X\ud83db", cells: 3 });
  });
});
