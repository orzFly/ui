import { describe, expect, it } from "vitest";

import {
  asciiDecoding,
  classify,
  glyphCells,
  latin1Decoding,
  type TextDecoding,
  tableDecoding,
} from "../src/text-decoding.ts";

function decode(
  decoding: TextDecoding,
  bytes: number[],
  mode: "abbreviations" | "dots" = "abbreviations",
) {
  return decoding.decodeRow(
    Uint8Array.from(bytes),
    { start: 0, before: 0, length: bytes.length },
    mode,
  );
}

describe("single-byte decodings", () => {
  it("keeps ASCII as it was, one byte per cell", () => {
    expect(decode(asciiDecoding, [0x41, 0x0a, 0x7f, 0x80, 0xff])).toEqual([
      { kind: "char", text: "A", length: 1 },
      { kind: "control", text: "LF", length: 1 },
      { kind: "control", text: "DT", length: 1 },
      { kind: "dot", length: 1 },
      { kind: "dot", length: 1 },
    ]);
    expect(asciiDecoding.lookahead).toBe(0);
  });

  it("decodes ISO-8859-1 as the byte's code point", () => {
    expect(decode(latin1Decoding, [0xe9, 0x85])).toEqual([
      { kind: "char", text: "é", length: 1 },
      { kind: "dot", length: 1 },
    ]);
  });

  it("decodes Windows-1252 through its table", () => {
    expect(decode(tableDecoding("windows-1252"), [0x80, 0x81])).toEqual([
      { kind: "char", text: "€", length: 1 },
      { kind: "dot", length: 1 },
    ]);
  });

  it("decodes a sample byte per table-built encoding", () => {
    expect(decode(tableDecoding("windows-1251"), [0xc0])[0]?.text).toBe("А");
    expect(decode(tableDecoding("koi8-r"), [0xc1])[0]?.text).toBe("а");
  });

  it("decodes only the row out of a wider window", () => {
    const cells = latin1Decoding.decodeRow(
      Uint8Array.of(0x41, 0x42, 0x43),
      { start: 7, before: 1, length: 1 },
      "dots",
    );
    expect(cells).toEqual([{ kind: "char", text: "B", length: 1 }]);
  });

  it("shows controls as dots in dots mode, in every table", () => {
    expect(decode(tableDecoding("windows-1251"), [0x0a], "dots")).toEqual([
      { kind: "dot", length: 1 },
    ]);
  });
});

describe("classify", () => {
  it.each([
    ["\u{FEFF}", "format"],
    ["\u{200B}", "zero-width space"],
    ["\u{0301}", "combining acute"],
    ["\u{0085}", "C1 control"],
    ["\u{E000}", "private use"],
    ["\u{2028}", "line separator"],
    ["\u{FFFD}", "replacement character"],
  ])("makes %s (%s) a dot", (text) => {
    expect(classify(text, "abbreviations").kind).toBe("dot");
  });

  it("keeps spaces and ideographic space as chars", () => {
    expect(classify(" ", "abbreviations").kind).toBe("char");
    expect(classify("\u{3000}", "abbreviations").kind).toBe("char");
  });

  it("names C0 controls, or dots them", () => {
    expect(classify("\n", "abbreviations")).toEqual({
      kind: "control",
      text: "LF",
    });
    expect(classify("\n", "dots")).toEqual({ kind: "dot" });
  });
});

describe("glyphCells", () => {
  it.each([
    ["A", 1],
    ["é", 1],
    ["世", 2],
    ["ア", 2],
    ["가", 2],
    ["😀", 2],
    ["ｱ", 1],
  ])("draws %s across %i cells", (text, cells) => {
    expect(glyphCells(text)).toBe(cells);
  });
});
