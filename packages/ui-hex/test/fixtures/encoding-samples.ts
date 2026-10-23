import type { HexEncoding } from "../../src/encodings.ts";

/**
 * One sample buffer per multi-byte encoding, plus three table-built ones:
 * a 16-byte binary header, ASCII, multi-byte text, then one invalid sequence.
 * In each multi-byte sample the first multi-byte glyph crosses offset 0x20,
 * the end of row 1 at 16 columns.
 */
export interface EncodingSample {
  bytes: Uint8Array;
  /** What the bytes between the header and the invalid tail decode to. */
  text: string;
  /** How many bytes at the end are the invalid sequence. */
  invalid: number;
}

export const SAMPLE_HEADER_LENGTH = 16;

// A PNG signature and IHDR chunk start: binary, with controls and high bytes.
const HEADER = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52,
];

function sample(
  ascii: string,
  text: string,
  body: ArrayLike<number>,
  invalid: number[],
): EncodingSample {
  const bytes = Uint8Array.from([
    ...HEADER,
    ...Array.from(ascii, (char) => char.charCodeAt(0)),
    ...Array.from(body),
    ...invalid,
  ]);
  return { bytes, text: ascii + text, invalid: invalid.length };
}

// TextEncoder only writes UTF-8, so UTF-16 is split from code units by hand.
function utf16(text: string, littleEndian: boolean): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (littleEndian) out.push(unit & 0xff, unit >> 8);
    else out.push(unit >> 8, unit & 0xff);
  }
  return out;
}

function utf16Sample(littleEndian: boolean): EncodingSample {
  const text = "Hello, 😀 世界 Ωμέγα";
  // A lone high surrogate.
  const invalid = littleEndian ? [0x00, 0xd8] : [0xd8, 0x00];
  return sample("", text, utf16(text, littleEndian), invalid);
}

const UTF8_TEXT = "世界 こんにちは 😀 Ωμέγα";

export const ENCODING_SAMPLE_PARTS: Partial<
  Record<HexEncoding, EncodingSample>
> = {
  // 14 ASCII bytes put 世 at 0x1E-0x20.
  "utf-8": sample(
    "Hello, world! ",
    UTF8_TEXT,
    new TextEncoder().encode(UTF8_TEXT),
    [0xe4, 0xff],
  ),
  // 7 ASCII code units put the 😀 pair at 0x1E-0x21.
  "utf-16le": utf16Sample(true),
  "utf-16be": utf16Sample(false),
  shift_jis: sample(
    "Shift_JIS text ",
    "こんにちは、世界 ｱｲｳ",
    [
      0x82, 0xb1, 0x82, 0xf1, 0x82, 0xc9, 0x82, 0xbf, 0x82, 0xcd, 0x81, 0x41,
      0x90, 0xa2, 0x8a, 0x45, 0x20, 0xb1, 0xb2, 0xb3,
    ],
    [0x81, 0xff],
  ),
  // 丂 is JIS X 0212, the 3-byte 8F form, at 0x1E-0x20.
  "euc-jp": sample(
    "EUC-JP sample ",
    "丂日本語テキスト ｶﾅ",
    [
      0x8f, 0xb0, 0xa1, 0xc6, 0xfc, 0xcb, 0xdc, 0xb8, 0xec, 0xa5, 0xc6, 0xa5,
      0xad, 0xa5, 0xb9, 0xa5, 0xc8, 0x20, 0x8e, 0xb6, 0x8e, 0xc5,
    ],
    [0xa1, 0xff],
  ),
  // 😀 is the 4-byte form at 0x1E-0x21.
  gb18030: sample(
    "GB18030 text: ",
    "😀世界你好 €",
    [
      0x94, 0x39, 0xfc, 0x36, 0xca, 0xc0, 0xbd, 0xe7, 0xc4, 0xe3, 0xba, 0xc3,
      0x20, 0xa2, 0xe3,
    ],
    [0x81, 0xff],
  ),
  big5: sample(
    "Big5 text here ",
    "中文字 繁體",
    [0xa4, 0xa4, 0xa4, 0xe5, 0xa6, 0x72, 0x20, 0xc1, 0x63, 0xc5, 0xe9],
    [0x81, 0xff],
  ),
  "euc-kr": sample(
    "EUC-KR sample: ",
    "한국어 텍스트",
    [
      0xc7, 0xd1, 0xb1, 0xb9, 0xbe, 0xee, 0x20, 0xc5, 0xd8, 0xbd, 0xba, 0xc6,
      0xae,
    ],
    [0x81, 0xff],
  ),
  // The single-byte samples have no glyph to cross a row end, and end on a
  // byte that shows as a dot: undefined in the table, or a C0 control.
  "windows-1252": sample(
    "Windows-1252: ",
    "café, naïve €5 — ok",
    [
      0x63, 0x61, 0x66, 0xe9, 0x2c, 0x20, 0x6e, 0x61, 0xef, 0x76, 0x65, 0x20,
      0x80, 0x35, 0x20, 0x97, 0x20, 0x6f, 0x6b,
    ],
    [0x81],
  ),
  "windows-1251": sample(
    "Windows-1251: ",
    "Привет, мир",
    [0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2, 0x2c, 0x20, 0xec, 0xe8, 0xf0],
    [0x98],
  ),
  "koi8-r": sample(
    "KOI8-R: ",
    "Привет, мир",
    [0xf0, 0xd2, 0xc9, 0xd7, 0xc5, 0xd4, 0x2c, 0x20, 0xcd, 0xc9, 0xd2],
    [0x1b],
  ),
};

export const ENCODING_SAMPLES: Partial<Record<HexEncoding, Uint8Array>> =
  Object.fromEntries(
    Object.entries(ENCODING_SAMPLE_PARTS).map(([id, part]) => [id, part.bytes]),
  );
