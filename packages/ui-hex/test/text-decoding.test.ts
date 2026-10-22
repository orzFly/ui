import { describe, expect, it } from "vitest";

import type { HexEncoding } from "../src/encodings.ts";
import {
  asciiDecoding,
  classify,
  glyphCells,
  latin1Decoding,
  type TextDecoding,
  tableDecoding,
} from "../src/text-decoding.ts";
import {
  eastAsianDecoding,
  multibyteProbe,
  utf8Decoding,
  utf16Decoding,
} from "../src/text-decoding-multibyte.ts";
import { ENCODING_SAMPLES } from "./fixtures/encoding-samples.ts";

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

const SAMPLE_DECODINGS = {
  ascii: asciiDecoding,
  "iso-8859-1": latin1Decoding,
  "windows-1252": tableDecoding("windows-1252"),
  "windows-1251": tableDecoding("windows-1251"),
  "koi8-r": tableDecoding("koi8-r"),
  "utf-8": utf8Decoding,
  "utf-16le": utf16Decoding(true),
  "utf-16be": utf16Decoding(false),
  shift_jis: eastAsianDecoding("shift_jis"),
  "euc-jp": eastAsianDecoding("euc-jp"),
  gb18030: eastAsianDecoding("gb18030"),
  big5: eastAsianDecoding("big5"),
  "euc-kr": eastAsianDecoding("euc-kr"),
} satisfies Partial<Record<HexEncoding, TextDecoding>>;

const EAST_ASIAN = new Set<string>([
  "shift_jis",
  "euc-jp",
  "gb18030",
  "big5",
  "euc-kr",
]);

/** The row `[start, start + length)` of `bytes`, given exactly the window its decoding asks for. */
function decodeAt(
  decoding: TextDecoding,
  bytes: Uint8Array,
  start: number,
  length: number,
  mode: "abbreviations" | "dots" = "abbreviations",
) {
  const from = Math.max(0, start - decoding.lookbehind);
  const to = Math.min(bytes.length, start + length + decoding.lookahead);
  return decoding.decodeRow(
    bytes.subarray(from, to),
    { start, before: start - from, length },
    mode,
  );
}

const char = (text: string, length: number) => ({
  kind: "char",
  text,
  length,
});
const dot = (length = 1) => ({ kind: "dot", length });
const cont = (lead: number) => ({ kind: "continuation", lead });

describe("UTF-8", () => {
  it("decodes each sequence length into a glyph cell and continuations", () => {
    expect(
      decode(
        utf8Decoding,
        [0x41, 0xc3, 0xa9, 0xe4, 0xb8, 0x96, 0xf0, 0x9f, 0x98, 0x80],
      ),
    ).toEqual([
      char("A", 1),
      char("é", 2),
      cont(1),
      char("世", 3),
      cont(3),
      cont(3),
      char("😀", 4),
      cont(6),
      cont(6),
      cont(6),
    ]);
  });

  it.each([
    ["overlong C0 80", [0xc0, 0x80]],
    ["overlong E0 80 80", [0xe0, 0x80, 0x80]],
    ["an encoded surrogate", [0xed, 0xa0, 0x80]],
    ["F5", [0xf5]],
    ["a sequence truncated by the source end", [0xe4, 0xb8]],
    ["stray continuations", [0x80, 0xbf]],
  ])("makes every byte of %s a dot", (_, bytes) => {
    expect(decode(utf8Decoding, bytes)).toEqual(bytes.map(() => dot()));
  });

  it("decodes a glyph that crosses the row end on its starting row", () => {
    const bytes = Uint8Array.of(0x41, 0xe4, 0xb8, 0x96, 0x42);
    expect(decodeAt(utf8Decoding, bytes, 0, 2)).toEqual([
      char("A", 1),
      char("世", 3),
    ]);
    expect(decodeAt(utf8Decoding, bytes, 2, 3)).toEqual([
      cont(1),
      cont(1),
      char("B", 1),
    ]);
  });

  it("leaves continuations after an invalid sequence as dots", () => {
    const bytes = Uint8Array.of(0xe4, 0x41, 0xb8, 0x96);
    expect(decodeAt(utf8Decoding, bytes, 2, 2)).toEqual([dot(), dot()]);
  });

  it("shows U+FEFF as a cell instead of stripping it", () => {
    expect(decode(utf8Decoding, [0xef, 0xbb, 0xbf])).toEqual([
      dot(3),
      cont(0),
      cont(0),
    ]);
  });

  it("decodes a repeated sequence through the glyph cache", () => {
    const bytes = [0xe4, 0xb8, 0x96, 0xe4, 0xb8, 0x96];
    decode(utf8Decoding, bytes);
    const before = multibyteProbe.decodes;
    decode(utf8Decoding, bytes);
    expect(multibyteProbe.decodes).toBe(before);
  });

  it("clears the glyph cache once it holds 4096 entries", () => {
    const first = [0xe4, 0xb8, 0x80];
    decode(utf8Decoding, first);
    const encoder = new TextEncoder();
    const bytes: number[] = [];
    for (let code = 0x4e01; code < 0x4e01 + 4096; code++) {
      bytes.push(...encoder.encode(String.fromCodePoint(code)));
    }
    decode(utf8Decoding, bytes);
    const before = multibyteProbe.decodes;
    decode(utf8Decoding, first);
    expect(multibyteProbe.decodes).toBe(before + 1);
  });
});

describe("UTF-16", () => {
  const le = utf16Decoding(true);
  const be = utf16Decoding(false);

  it("decodes ASCII as a char and a continuation", () => {
    expect(decode(le, [0x41, 0x00])).toEqual([char("A", 2), cont(0)]);
    expect(decode(be, [0x00, 0x41])).toEqual([char("A", 2), cont(0)]);
  });

  it("names LF as a control", () => {
    expect(decode(le, [0x0a, 0x00])).toEqual([
      { kind: "control", text: "LF", length: 2 },
      cont(0),
    ]);
  });

  it("decodes a surrogate pair as one 4-byte glyph", () => {
    expect(decode(le, [0x3d, 0xd8, 0x00, 0xde])).toEqual([
      char("😀", 4),
      cont(0),
      cont(0),
      cont(0),
    ]);
    expect(decode(be, [0xd8, 0x3d, 0xde, 0x00])[0]).toEqual(char("😀", 4));
  });

  it("makes lone high and low surrogates 2-byte dots", () => {
    expect(decode(le, [0x00, 0xd8, 0x41, 0x00, 0x00, 0xdc])).toEqual([
      dot(2),
      cont(0),
      char("A", 2),
      cont(2),
      dot(2),
      cont(4),
    ]);
  });

  it("makes a final odd byte a 1-byte dot", () => {
    expect(decode(le, [0x41, 0x00, 0x42])).toEqual([
      char("A", 2),
      cont(0),
      dot(1),
    ]);
  });

  it("opens a row that starts mid-unit with a continuation, at odd columns", () => {
    const bytes = Uint8Array.of(0x41, 0x00, 0x42, 0x00, 0x43, 0x00);
    expect(decodeAt(le, bytes, 3, 3)).toEqual([cont(2), char("C", 2), cont(4)]);
  });

  it("opens a row that starts inside a pair's low surrogate inside the pair", () => {
    const bytes = Uint8Array.of(0x41, 0x00, 0x3d, 0xd8, 0x00, 0xde, 0x42, 0x00);
    expect(decodeAt(le, bytes, 5, 3)).toEqual([cont(2), char("B", 2), cont(6)]);
    expect(decodeAt(le, bytes, 4, 2)).toEqual([cont(2), cont(2)]);
  });
});

describe("East Asian", () => {
  it.each([
    ["shift_jis", [0x82, 0xa0], "あ"],
    ["euc-jp", [0xa4, 0xa2], "あ"],
    ["gb18030", [0xca, 0xc0], "世"],
    ["big5", [0xa4, 0xa4], "中"],
    ["euc-kr", [0xc7, 0xd1], "한"],
  ] as const)("decodes a known %s character", (id, bytes, text) => {
    expect(decode(eastAsianDecoding(id), [0x41, ...bytes])).toEqual([
      char("A", 1),
      char(text, 2),
      cont(1),
    ]);
  });

  it("never lets a lead the decoder passes through swallow its trail", () => {
    // Node's ICU euc-kr returns U+0081 U+0020 here instead of throwing.
    expect(
      decode(eastAsianDecoding("euc-kr"), [0x81, 0x20, 0x90, 0x0a]),
    ).toEqual([
      dot(),
      char(" ", 1),
      dot(),
      { kind: "control", text: "LF", length: 1 },
    ]);
  });

  it("decodes GB18030 four-byte sequences", () => {
    const gb = eastAsianDecoding("gb18030");
    expect(decode(gb, [0x81, 0x30, 0x81, 0x30])[0]).toEqual(dot(4));
    expect(decode(gb, [0x82, 0x35, 0x8f, 0x33])[0]).toEqual(
      char("\u{9FA6}", 4),
    );
    expect(decode(gb, [0x95, 0x32, 0x82, 0x36])).toEqual([
      char("\u{20000}", 4),
      cont(0),
      cont(0),
      cont(0),
    ]);
  });

  it("decodes the EUC-JP three-byte form", () => {
    expect(decode(eastAsianDecoding("euc-jp"), [0x8f, 0xb0, 0xa1])).toEqual([
      char("丂", 3),
      cont(0),
      cont(0),
    ]);
  });

  it("decodes Shift_JIS halfwidth katakana as one byte", () => {
    expect(decode(eastAsianDecoding("shift_jis"), [0xb1])).toEqual([
      char("ｱ", 1),
    ]);
  });

  it("makes a lead with an invalid trail a dot and keeps the trail", () => {
    expect(decode(eastAsianDecoding("shift_jis"), [0x82, 0x20])).toEqual([
      dot(),
      char(" ", 1),
    ]);
  });

  it("resynchronises through the nearest sync byte", () => {
    // From the space, 82 82 is ｂ and A0 alone is invalid; starting at the
    // row would read 82 A0 as あ instead.
    const bytes = Uint8Array.of(0x20, 0x82, 0x82, 0xa0);
    expect(decodeAt(eastAsianDecoding("shift_jis"), bytes, 2, 2)).toEqual([
      cont(1),
      dot(),
    ]);
  });

  it("best effort, rows may disagree: a 100-byte run with no sync byte still gives one cell per byte", () => {
    const decoding = eastAsianDecoding("shift_jis");
    const bytes = new Uint8Array(100).fill(0x82);
    for (const columns of [16, 15, 7]) {
      for (let start = 0; start < bytes.length; start += columns) {
        const length = Math.min(columns, bytes.length - start);
        expect(decodeAt(decoding, bytes, start, length)).toHaveLength(length);
      }
    }
  });
});

// Seeded, so a failing buffer reproduces.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHAR_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x20, 0x7e],
  [0xa0, 0x17f],
  [0x391, 0x3c9],
  [0x3040, 0x30ff],
  [0x4e00, 0x9fff],
  [0xac00, 0xd7a3],
  [0xff61, 0xff9f],
  [0x1f600, 0x1f64f],
];

// Random bytes alone rarely form a valid multi-byte sequence, so most of the
// buffer is characters the decoding can encode.
function randomBuffer(
  random: () => number,
  decoding: TextDecoding,
  eastAsian: boolean,
): Uint8Array {
  const size = Math.floor(random() * 601);
  const bytes: number[] = [];
  while (bytes.length < size) {
    if (random() < 0.3) {
      bytes.push(Math.floor(random() * 256));
      continue;
    }
    const [from, to] = CHAR_RANGES[
      Math.floor(random() * CHAR_RANGES.length)
    ] as readonly [number, number];
    const code = from + Math.floor(random() * (to - from + 1));
    const encoded = decoding.encode?.(String.fromCodePoint(code));
    if (encoded) bytes.push(...encoded);
  }
  const out = Uint8Array.from(bytes.slice(0, size));
  if (eastAsian) {
    for (let i = 47; i < out.length; i += 48) out[i] = 0x20;
  }
  return out;
}

function expectRowsAgree(
  decoding: TextDecoding,
  bytes: Uint8Array,
  mode: "abbreviations" | "dots",
) {
  const whole = decoding.decodeRow(
    bytes,
    { start: 0, before: 0, length: bytes.length },
    mode,
  );
  // Strings first: deep-equal on every buffer is what makes the test slow.
  const wholeJson = JSON.stringify(whole);
  for (const columns of [16, 15, 7]) {
    const rows = [];
    for (let start = 0; start < bytes.length; start += columns) {
      const length = Math.min(columns, bytes.length - start);
      const cells = decodeAt(decoding, bytes, start, length, mode);
      if (cells.length !== length) expect(cells).toHaveLength(length);
      rows.push(...cells);
    }
    if (JSON.stringify(rows) !== wholeJson) {
      expect({ columns, bytes: [...bytes], rows }).toEqual({
        columns,
        bytes: [...bytes],
        rows: whole,
      });
    }
  }
}

describe("row-by-row consistency", () => {
  it.each(Object.entries(SAMPLE_DECODINGS))(
    "rows of random %s buffers agree with one whole-buffer decode",
    (id, decoding) => {
      const random = mulberry32(0x5eed);
      multibyteProbe.overruns = 0;
      for (let n = 0; n < 200; n++) {
        const bytes = randomBuffer(random, decoding, EAST_ASIAN.has(id));
        expectRowsAgree(decoding, bytes, n % 2 ? "dots" : "abbreviations");
      }
      expect(multibyteProbe.overruns).toBe(0);
    },
  );

  it.each(Object.entries(ENCODING_SAMPLES))(
    "rows of the %s sample agree with one whole-buffer decode",
    (id, bytes) => {
      const decoding = SAMPLE_DECODINGS[id as keyof typeof SAMPLE_DECODINGS];
      multibyteProbe.overruns = 0;
      expectRowsAgree(decoding, bytes, "abbreviations");
      expect(multibyteProbe.overruns).toBe(0);
    },
  );
});
