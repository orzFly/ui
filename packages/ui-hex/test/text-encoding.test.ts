import { describe, expect, it } from "vitest";

import {
  getTextDecoding,
  HEX_ENCODINGS,
  type HexEncoding,
} from "../src/encodings.ts";
import {
  asciiDecoding,
  latin1Decoding,
  tableDecoding,
} from "../src/text-decoding.ts";
import {
  type EastAsianEncoding,
  eastAsianDecoding,
  multibyteProbe,
  reverseMapOf,
  utf8Decoding,
  utf16Decoding,
} from "../src/text-decoding-multibyte.ts";
import {
  ENCODING_SAMPLE_PARTS,
  SAMPLE_HEADER_LENGTH,
} from "./fixtures/encoding-samples.ts";

const bytes = (
  decoding: { encode?(text: string): Uint8Array | null },
  text: string,
) => {
  const out = decoding.encode?.(text);
  return out ? [...out] : out;
};

/** What a standard decoder reads back; ASCII and ISO-8859-1 are computed, as in the decodings. */
function decodeText(id: HexEncoding, input: Uint8Array): string {
  if (id === "ascii" || id === "iso-8859-1") {
    return String.fromCharCode(...input);
  }
  // Not ignoreBOM: Node 22 drops a lone FF from windows-1252 under it.
  return new TextDecoder(id).decode(input);
}

function unpack(packed: number): number[] {
  const length = packed % 8;
  let value = Math.floor(packed / 8);
  const out: number[] = [];
  for (let k = 0; k < length; k++) {
    out.unshift(value % 256);
    value = Math.floor(value / 256);
  }
  return out;
}

const SCRIPTS: Partial<Record<HexEncoding, string>> = {
  ascii: "Hello\t~\u0000",
  "iso-8859-1": "café ÿ ¿ ×",
  "utf-8": "Aé世😀한ｱ\u0000\u{10FFFF}",
  "utf-16le": "Aé世😀한ｱ\u0000",
  "utf-16be": "Aé世😀한ｱ\u0000",
  shift_jis: "あア漢字ｱ、Ａ①ⅰ纊",
  "euc-jp": "あア漢字ｶ、Ａ①",
  gb18030: "世界你好€😀𠀀\u0080é",
  big5: "中文繁體字，",
  "euc-kr": "한국어텍스트가",
};

describe("encode round trip", () => {
  it.each(HEX_ENCODINGS.map((info) => info.id))(
    "reads %s's sample characters back",
    (id) => {
      const decoding = getTextDecoding(id);
      // A table-built encoding's sample is every character its table defines.
      const text =
        SCRIPTS[id] ??
        [
          ...decodeText(
            id,
            Uint8Array.from({ length: 0xe0 }, (_, i) => i + 0x20),
          ),
        ]
          .filter((char) => char !== "\u{FFFD}")
          .join("");
      for (const char of text) {
        const encoded = decoding.encode?.(char);
        expect(encoded, `${id} ${char}`).not.toBeNull();
        expect(decodeText(id, encoded as Uint8Array)).toBe(char);
      }
    },
  );

  // The standard encoders' asymmetric steps: these encode to bytes that read
  // back as another character.
  const ASYMMETRIC: Record<EastAsianEncoding, number[]> = {
    shift_jis: [0x80, 0xa5, 0x203e, 0x2212],
    "euc-jp": [0xa5, 0x203e, 0x2212],
    gb18030: [
      0xe78d, 0xe78e, 0xe78f, 0xe790, 0xe791, 0xe792, 0xe793, 0xe794, 0xe795,
      0xe796, 0xe81e, 0xe826, 0xe82b, 0xe82c, 0xe832, 0xe843, 0xe854, 0xe864,
    ],
    big5: [],
    "euc-kr": [],
  };

  it.each(Object.keys(ASYMMETRIC) as EastAsianEncoding[])(
    "reads every %s reverse-map entry back",
    (id) => {
      const decoding = eastAsianDecoding(id);
      const map = reverseMapOf(decoding) as ReadonlyMap<number, number>;
      expect(map.size).toBeGreaterThan(1000);
      const decoder = new TextDecoder(id, { fatal: true });
      const asymmetric = new Set(ASYMMETRIC[id]);
      for (const [code, packed] of map) {
        const sequence = unpack(packed);
        expect(bytes(decoding, String.fromCodePoint(code))).toEqual(sequence);
        if (asymmetric.has(code)) continue;
        const back = decoder.decode(Uint8Array.from(sequence));
        if (back !== String.fromCodePoint(code)) {
          expect([code.toString(16), back]).toEqual([
            code.toString(16),
            String.fromCodePoint(code),
          ]);
        }
      }
    },
  );
});

describe("encode known bytes", () => {
  it.each([
    ["shift_jis", "あ", [0x82, 0xa0]],
    ["euc-jp", "あ", [0xa4, 0xa2]],
    ["gb18030", "世", [0xca, 0xc0]],
    ["big5", "中", [0xa4, 0xa4]],
    ["euc-kr", "한", [0xc7, 0xd1]],
    ["gb18030", "😀", [0x94, 0x39, 0xfc, 0x36]],
    // gb18030's encoder only writes 80 for € as GBK; otherwise it takes the
    // index pointer.
    ["gb18030", "€", [0xa2, 0xe3]],
    ["windows-1252", "€", [0x80]],
    ["iso-8859-1", "é", [0xe9]],
    ["ascii", "Hi", [0x48, 0x69]],
    ["utf-8", "é😀", [0xc3, 0xa9, 0xf0, 0x9f, 0x98, 0x80]],
    ["utf-16le", "A😀", [0x41, 0x00, 0x3d, 0xd8, 0x00, 0xde]],
    ["utf-16be", "A😀", [0x00, 0x41, 0xd8, 0x3d, 0xde, 0x00]],
  ] as const)("encodes %s %s", (id, text, expected) => {
    expect(bytes(getTextDecoding(id), text)).toEqual(expected);
  });

  it.each(["shift_jis", "euc-jp", "gb18030", "big5", "euc-kr"] as const)(
    "writes code points below 0x80, nulls included, as themselves in %s",
    (id) => {
      expect(bytes(eastAsianDecoding(id), "A\u0000~\u007f")).toEqual([
        0x41, 0x00, 0x7e, 0x7f,
      ]);
    },
  );
});

describe("encode refusals", () => {
  it.each([
    ["windows-1252", "あ"],
    ["iso-8859-1", "€"],
    ["ascii", "é"],
    ["shift_jis", "😀"],
    ["big5", "😀"],
    ["euc-kr", "😀"],
    // JIS X 0212 is decode-only.
    ["euc-jp", "丂"],
    // A3 A0 reads as U+3000, so the standard refuses U+E5E5.
    ["gb18030", "\u{E5E5}"],
    // EUDC: decodes from F0 40, but is in no index.
    ["shift_jis", "\u{E000}"],
  ] as const)("returns null for %s %s", (id, text) => {
    expect(getTextDecoding(id).encode?.(text)).toBeNull();
  });

  it.each([
    "utf-8",
    "utf-16le",
    "utf-16be",
    "shift_jis",
    "gb18030",
    "windows-1252",
  ] as const)("returns null for a lone surrogate in %s", (id) => {
    expect(getTextDecoding(id).encode?.("a\u{D800}")).toBeNull();
    expect(getTextDecoding(id).encode?.("\u{DC00}")).toBeNull();
  });
});

describe("the Encoding Standard's encoder exceptions", () => {
  it("encodes an NEC-selected Shift_JIS duplicate to its IBM pointer", () => {
    // ED 40 and FA 5C both read as 纊; ED 40-EF FC are left out of the index.
    expect(bytes(getTextDecoding("shift_jis"), "纊")).toEqual([0xfa, 0x5c]);
    expect(bytes(getTextDecoding("shift_jis"), "ⅰ")).toEqual([0xfa, 0x40]);
    const map = reverseMapOf(getTextDecoding("shift_jis")) as ReadonlyMap<
      number,
      number
    >;
    for (const packed of map.values()) {
      const [lead] = unpack(packed);
      expect(lead !== undefined && lead >= 0xed && lead <= 0xf9).toBe(false);
    }
  });

  it.each([
    ["shift_jis", "\u{00A5}", [0x5c]],
    ["shift_jis", "\u{203E}", [0x7e]],
    ["shift_jis", "\u{2212}", [0x81, 0x7c]],
    ["shift_jis", "\u{0080}", [0x80]],
    ["shift_jis", "ｱ", [0xb1]],
    ["euc-jp", "\u{00A5}", [0x5c]],
    ["euc-jp", "\u{203E}", [0x7e]],
    ["euc-jp", "\u{2212}", [0xa1, 0xdd]],
    ["euc-jp", "ｱ", [0x8e, 0xb1]],
    // index Big5 pointer takes the last pointer for these six.
    ["big5", "\u{2550}", [0xf9, 0xf9]],
    ["gb18030", "\u{3000}", [0xa1, 0xa1]],
    ["gb18030", "\u{E78D}", [0xa6, 0xd9]],
    ["gb18030", "\u{FE10}", [0xa6, 0xd9]],
    ["gb18030", "\u{E7C7}", [0x81, 0x35, 0xf4, 0x37]],
    ["gb18030", "\u{0080}", [0x81, 0x30, 0x81, 0x30]],
  ] as const)("encodes %s %s per the standard", (id, text, expected) => {
    expect(bytes(getTextDecoding(id), text)).toEqual(expected);
  });

  it("leaves Big5's HKSCS leads out", () => {
    const map = reverseMapOf(getTextDecoding("big5")) as ReadonlyMap<
      number,
      number
    >;
    for (const packed of map.values()) {
      expect(unpack(packed)[0]).toBeGreaterThanOrEqual(0xa1);
    }
  });
});

describe("prepareEncode", () => {
  it("builds the reverse map so a later encode decodes nothing", () => {
    const decoding = eastAsianDecoding("gb18030");
    decoding.prepareEncode?.();
    const before = multibyteProbe.decodes;
    expect(bytes(decoding, "世界😀")).toEqual([
      0xca, 0xc0, 0xbd, 0xe7, 0x94, 0x39, 0xfc, 0x36,
    ]);
    expect(multibyteProbe.decodes).toBe(before);
  });

  it("is otherwise built by the first encode", () => {
    const decoding = eastAsianDecoding("euc-kr");
    const before = multibyteProbe.decodes;
    decoding.encode?.("한");
    expect(multibyteProbe.decodes).toBeGreaterThan(before);
  });

  it("is not needed where nothing is built", () => {
    for (const decoding of [
      asciiDecoding,
      latin1Decoding,
      tableDecoding("windows-1252"),
      utf8Decoding,
      utf16Decoding(true),
    ]) {
      expect(decoding.prepareEncode).toBeUndefined();
    }
  });
});

describe("ENCODING_SAMPLES", () => {
  it.each(Object.entries(ENCODING_SAMPLE_PARTS))(
    "holds the %s literals it documents",
    (id, sample) => {
      const encoding = id as HexEncoding;
      const end = sample.bytes.length - sample.invalid;
      expect(
        decodeText(encoding, sample.bytes.subarray(SAMPLE_HEADER_LENGTH, end)),
      ).toBe(sample.text);
      // The tail shows as dots and nothing else.
      const decoding = getTextDecoding(encoding);
      const cells = decoding.decodeRow(
        sample.bytes,
        { start: end, before: end, length: sample.invalid },
        "dots",
      );
      expect(
        cells.every(
          (cell) => cell.kind === "dot" || cell.kind === "continuation",
        ),
      ).toBe(true);
    },
  );

  it.each(
    Object.entries(ENCODING_SAMPLE_PARTS).filter(
      ([id]) => getTextDecoding(id as HexEncoding).lookahead > 0,
    ),
  )("puts a %s glyph across offset 0x20", (id, sample) => {
    const decoding = getTextDecoding(id as HexEncoding);
    const cells = decoding.decodeRow(
      sample.bytes,
      { start: 0, before: 0, length: sample.bytes.length },
      "abbreviations",
    );
    const lead = cells[0x20]?.lead as number;
    expect(cells[0x20]?.kind).toBe("continuation");
    expect(lead).toBeLessThan(0x20);
    expect(cells[lead]?.kind).toBe("char");
  });
});
