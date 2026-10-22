import {
  classify,
  hasLoneSurrogate,
  type TextCell,
  type TextDecoding,
  type TextRow,
} from "./text-decoding.ts";
import type { ControlCodes } from "./types.ts";

export type EastAsianEncoding =
  | "shift_jis"
  | "euc-jp"
  | "gb18030"
  | "big5"
  | "euc-kr";

/**
 * Test instrumentation, not exported from the package: `decodes` counts
 * `TextDecoder` calls, `overruns` counts candidates that ran past a window end
 * that still had its full lookahead, which the lookahead rules make impossible.
 */
export const multibyteProbe = { decodes: 0, overruns: 0 };

interface Rule {
  lookbehind: number;
  lookahead: number;
  decoder: TextDecoder;
  /** How many bytes a failed sequence covers: one unit. */
  failLength: number;
  /** Bytes below 0x80 are themselves, without the decoder. */
  asciiFastPath: boolean;
  /** Where in the window decoding has to start for the row to agree with its neighbours. */
  resync(window: Uint8Array, row: TextRow, decode: Decode): number;
  lengthAt(window: Uint8Array, i: number): number;
}

type Decode = (window: Uint8Array, i: number, length: number) => TextCell;

const CACHE_LIMIT = 4096;

function fatalDecoder(label: string): TextDecoder {
  return new TextDecoder(label, {
    fatal: true,
    // A UTF BOM is a character to show, not a mark to strip. The other
    // decoders never strip one, and Node 22 drops a lone FF from some of
    // them under ignoreBOM.
    ignoreBOM: label.startsWith("utf-"),
  });
}

/** `bytes` big-endian, times 8, plus the length: unique for up to 4 bytes, and exact in a double. */
function pack(window: ArrayLike<number>, i: number, length: number): number {
  let key = 0;
  for (let k = 0; k < length; k++) key = key * 256 + (window[i + k] as number);
  return key * 8 + length;
}

function unpack(packed: number, out: number[]): void {
  const length = packed % 8;
  const bytes = Math.floor(packed / 8);
  for (let k = length - 1; k >= 0; k--) {
    out.push(Math.floor(bytes / 256 ** k) % 256);
  }
}

function asciiCells(controlCodes: ControlCodes): readonly TextCell[] {
  const cells: TextCell[] = [];
  for (let byte = 0; byte < 0x80; byte++) {
    cells[byte] = {
      ...classify(String.fromCharCode(byte), controlCodes),
      length: 1,
    };
  }
  return cells;
}
const ASCII = {
  abbreviations: asciiCells("abbreviations"),
  dots: asciiCells("dots"),
};

function decodeWith(decoder: TextDecoder, bytes: Uint8Array): string | null {
  multibyteProbe.decodes++;
  try {
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Node's ICU euc-kr lacks the UHC extension, and instead of throwing on a lead
 * it does not know, passes it through as a C1 control followed by the trail.
 * Taken as one glyph, that would swallow the trail byte.
 */
function passedThrough(text: string): boolean {
  const first = text.codePointAt(0) as number;
  return first >= 0x80 && first <= 0x9f && text.length > 1;
}

function multiByte(
  rule: Rule,
  encode: (text: string) => Uint8Array | null,
  prepareEncode?: () => void,
): TextDecoding {
  // One cache per mode, so the key stays the bytes alone.
  const caches = { abbreviations: new Map(), dots: new Map() } as Record<
    ControlCodes,
    Map<number, TextCell>
  >;

  function cachedDecode(controlCodes: ControlCodes): Decode {
    const cache = caches[controlCodes];
    return (window, i, length) => {
      const key = pack(window, i, length);
      let cell = cache.get(key);
      if (!cell) {
        const text = decodeWith(rule.decoder, window.subarray(i, i + length));
        cell =
          text === null || passedThrough(text)
            ? { kind: "dot", length: rule.failLength }
            : { ...classify(text, controlCodes), length };
        if (cache.size >= CACHE_LIMIT) cache.clear();
        cache.set(key, cell);
      }
      return cell;
    };
  }

  return {
    lookbehind: rule.lookbehind,
    lookahead: rule.lookahead,
    decodeRow(window, row, controlCodes) {
      return decodeSequences(
        window,
        row,
        rule,
        cachedDecode(controlCodes),
        ASCII[controlCodes],
      );
    },
    encode,
    ...(prepareEncode ? { prepareEncode } : {}),
  };
}

function decodeSequences(
  window: Uint8Array,
  row: TextRow,
  rule: Rule,
  decode: Decode,
  ascii: readonly TextCell[],
): TextCell[] {
  const out: TextCell[] = new Array(row.length);
  if (row.length === 0) return out;
  const end = row.before + row.length;
  // A window cut short of its lookahead ends at the source end.
  const atSourceEnd = window.length - end < rule.lookahead;
  const base = row.start - row.before;
  let i = rule.resync(window, row, decode);
  while (i < end) {
    const byte = window[i] as number;
    let cell: TextCell;
    if (rule.asciiFastPath && byte < 0x80) {
      cell = ascii[byte] as TextCell;
    } else {
      const length = rule.lengthAt(window, i);
      if (i + length > window.length) {
        if (!atSourceEnd) multibyteProbe.overruns++;
        cell = {
          kind: "dot",
          length: Math.min(rule.failLength, window.length - i),
        };
      } else {
        cell = decode(window, i, length);
      }
    }
    const length = cell.length as number;
    for (let k = 0; k < length; k++) {
      const j = i + k - row.before;
      if (j < 0 || j >= row.length) continue;
      out[j] = k === 0 ? cell : { kind: "continuation", lead: base + i };
    }
    i += length;
  }
  return out;
}

// --- UTF-8 ----------------------------------------------------------------

function utf8Length(byte: number): number {
  if (byte >= 0xc2 && byte <= 0xdf) return 2;
  if (byte >= 0xe0 && byte <= 0xef) return 3;
  if (byte >= 0xf0 && byte <= 0xf4) return 4;
  return 1;
}

const isUtf8Continuation = (byte: number) => (byte & 0xc0) === 0x80;

const UTF8_RULE: Rule = {
  lookbehind: 3,
  lookahead: 3,
  decoder: fatalDecoder("utf-8"),
  failLength: 1,
  asciiFastPath: true,
  resync(window, { before }, decode) {
    if (!isUtf8Continuation(window[before] as number)) return before;
    for (let j = before - 1; j >= 0 && j >= before - 3; j--) {
      const byte = window[j] as number;
      if (isUtf8Continuation(byte)) continue;
      const length = utf8Length(byte);
      // Only a lead whose sequence is valid owns the continuations; an
      // invalid one decays to a dot and leaves them as dots too.
      if (
        j + length > before &&
        j + length <= window.length &&
        decode(window, j, length).length === length
      ) {
        return j;
      }
      return before;
    }
    return before;
  },
  lengthAt: (window, i) => utf8Length(window[i] as number),
};

const utf8Encoder = new TextEncoder();

export const utf8Decoding: TextDecoding = multiByte(UTF8_RULE, (text) =>
  // TextEncoder writes EF BF BD for a lone surrogate instead of failing.
  hasLoneSurrogate(text) ? null : utf8Encoder.encode(text),
);

// --- UTF-16 ---------------------------------------------------------------

const isHigh = (unit: number) => unit >= 0xd800 && unit <= 0xdbff;
const isLow = (unit: number) => unit >= 0xdc00 && unit <= 0xdfff;

export function utf16Decoding(littleEndian: boolean): TextDecoding {
  const unitAt = (window: Uint8Array, i: number) =>
    littleEndian
      ? (window[i] as number) | ((window[i + 1] as number) << 8)
      : ((window[i] as number) << 8) | (window[i + 1] as number);
  const rule: Rule = {
    lookbehind: 3,
    lookahead: 3,
    decoder: fatalDecoder(littleEndian ? "utf-16le" : "utf-16be"),
    failLength: 2,
    asciiFastPath: false,
    resync(window, { start, before }) {
      let i = start % 2 === 1 ? Math.max(0, before - 1) : before;
      if (
        i >= 2 &&
        i + 2 <= window.length &&
        isLow(unitAt(window, i)) &&
        isHigh(unitAt(window, i - 2))
      ) {
        i -= 2;
      }
      return i;
    },
    lengthAt(window, i) {
      if (
        i + 4 <= window.length &&
        isHigh(unitAt(window, i)) &&
        isLow(unitAt(window, i + 2))
      ) {
        return 4;
      }
      return 2;
    },
  };
  return multiByte(rule, (text) => {
    if (hasLoneSurrogate(text)) return null;
    const out = new Uint8Array(text.length * 2);
    for (let i = 0; i < text.length; i++) {
      const unit = text.charCodeAt(i);
      out[2 * i + (littleEndian ? 0 : 1)] = unit & 0xff;
      out[2 * i + (littleEndian ? 1 : 0)] = unit >> 8;
    }
    return out;
  });
}

// --- East Asian -----------------------------------------------------------

const inRange = (byte: number, from: number, to: number) =>
  byte >= from && byte <= to;

interface EastAsianFamily {
  lookahead: number;
  /** Below this, a byte is a single-byte character and never a later byte of a sequence. */
  syncBelow: number;
  lengthAt(window: Uint8Array, i: number): number;
  buildReverse(add: Add): void;
}

/** Decodes `bytes` and records them as the encoding of the code point they decode to. */
type Add = (bytes: number[]) => void;

const SHIFT_JIS_LEAD = (byte: number) =>
  inRange(byte, 0x81, 0x9f) || inRange(byte, 0xe0, 0xfc);

const packBytes = (bytes: number[]) => pack(bytes, 0, bytes.length);

/** The encoder steps both Japanese encoders share, after the decoded grid. */
function japaneseExceptions(map: Map<number, number>): void {
  map.set(0xa5, packBytes([0x5c]));
  map.set(0x203e, packBytes([0x7e]));
  const minus = map.get(0xff0d);
  if (minus === undefined) map.delete(0x2212);
  else map.set(0x2212, minus);
}

// gb18030 encoder's side table: Private Use code points GB18030-2022 moved
// off these sequences, which still encode to them.
const GB18030_PUA: ReadonlyArray<readonly [number, number, number]> = [
  [0xe78d, 0xa6, 0xd9],
  [0xe78e, 0xa6, 0xda],
  [0xe78f, 0xa6, 0xdb],
  [0xe790, 0xa6, 0xdc],
  [0xe791, 0xa6, 0xdd],
  [0xe792, 0xa6, 0xde],
  [0xe793, 0xa6, 0xdf],
  [0xe794, 0xa6, 0xec],
  [0xe795, 0xa6, 0xed],
  [0xe796, 0xa6, 0xf3],
  [0xe81e, 0xfe, 0x59],
  [0xe826, 0xfe, 0x61],
  [0xe82b, 0xfe, 0x66],
  [0xe82c, 0xfe, 0x67],
  [0xe832, 0xfe, 0x6d],
  [0xe843, 0xfe, 0x7e],
  [0xe854, 0xfe, 0x90],
  [0xe864, 0xfe, 0xa0],
];

/** Code points from U+10000 up sit linearly from 90 30 81 30. */
function gb18030Supplementary(code: number, out: number[]): void {
  const i = code - 0x10000;
  out.push(
    0x90 + Math.floor(i / 12600),
    0x30 + (Math.floor(i / 1260) % 10),
    0x81 + (Math.floor(i / 10) % 126),
    0x30 + (i % 10),
  );
}

function twoByteGrid(
  add: Add,
  leads: (byte: number) => boolean,
  trailFrom: number,
): void {
  for (let lead = 0x81; lead <= 0xfe; lead++) {
    if (!leads(lead)) continue;
    for (let trail = trailFrom; trail <= 0xfe; trail++) add([lead, trail]);
  }
}

// The reverse maps follow the encoder sections of the Encoding Standard,
// Living Standard last updated 19 October 2026: 10.2.2 gb18030, 11.1.2 Big5,
// 12.1.2 EUC-JP, 12.3.2 Shift_JIS and 13.1.2 EUC-KR, with section 5's index
// Shift_JIS pointer and index Big5 pointer. Enumerating the decoder in
// pointer order and keeping the first hit is the standard's index pointer;
// each exception below is one of those sections' steps.
const FAMILIES: Record<EastAsianEncoding, EastAsianFamily> = {
  shift_jis: {
    lookahead: 1,
    syncBelow: 0x40,
    lengthAt: (window, i) => (SHIFT_JIS_LEAD(window[i] as number) ? 2 : 1),
    buildReverse(add) {
      // The single bytes 80 and A1-DF are encoder steps, set afterwards.
      // Leads ED-EF are pointers 8272-8835, the NEC-selected IBM extensions,
      // which index Shift_JIS pointer leaves out so the IBM copies at FA-FC
      // win. Leads F0-F9 are the EUDC range, which decodes to Private Use but
      // is in no index, so it has no encoding.
      twoByteGrid(
        add,
        (lead) =>
          SHIFT_JIS_LEAD(lead) &&
          !inRange(lead, 0xed, 0xef) &&
          !inRange(lead, 0xf0, 0xf9),
        0x40,
      );
    },
  },
  "euc-jp": {
    lookahead: 3,
    syncBelow: 0x80,
    lengthAt(window, i) {
      const byte = window[i] as number;
      if (byte === 0x8f) return 3;
      return byte === 0x8e || inRange(byte, 0xa1, 0xfe) ? 2 : 1;
    },
    buildReverse(add) {
      for (let trail = 0xa1; trail <= 0xdf; trail++) add([0x8e, trail]);
      // The 8F (JIS X 0212) form is decode-only.
      twoByteGrid(add, (lead) => lead >= 0xa1, 0xa1);
    },
  },
  gb18030: {
    lookahead: 3,
    syncBelow: 0x30,
    lengthAt(window, i) {
      const byte = window[i] as number;
      if (!inRange(byte, 0x81, 0xfe)) return 1;
      return inRange(window[i + 1] ?? 0, 0x30, 0x39) ? 4 : 2;
    },
    buildReverse(add) {
      // No single 80: with is GBK false, € takes its index pointer, A2 E3.
      twoByteGrid(add, () => true, 0x40);
      // The ranges pointer comes after the index pointer, so the BMP's
      // four-byte forms only fill in what the two-byte index lacks.
      for (let pointer = 0; pointer <= 39419; pointer++) {
        add([
          0x81 + Math.floor(pointer / 12600),
          0x30 + (Math.floor(pointer / 1260) % 10),
          0x81 + (Math.floor(pointer / 10) % 126),
          0x30 + (pointer % 10),
        ]);
      }
    },
  },
  big5: {
    lookahead: 1,
    syncBelow: 0x40,
    lengthAt: (window, i) => (inRange(window[i] as number, 0x81, 0xfe) ? 2 : 1),
    buildReverse(add) {
      // Leads 81-A0 are the HKSCS extensions, which index Big5 pointer skips.
      twoByteGrid(add, (lead) => lead >= 0xa1, 0x40);
    },
  },
  "euc-kr": {
    lookahead: 1,
    syncBelow: 0x41,
    lengthAt: (window, i) => (inRange(window[i] as number, 0x81, 0xfe) ? 2 : 1),
    buildReverse(add) {
      twoByteGrid(add, () => true, 0x41);
    },
  },
};

// index Big5 pointer takes the last pointer for these.
const BIG5_LAST = new Set([0x2550, 0x255e, 0x2561, 0x256a, 0x5341, 0x5345]);

function applyExceptions(
  id: EastAsianEncoding,
  map: Map<number, number>,
): void {
  switch (id) {
    case "shift_jis":
      map.set(0x80, packBytes([0x80]));
      for (let code = 0xff61; code <= 0xff9f; code++) {
        map.set(code, packBytes([code - 0xff61 + 0xa1]));
      }
      japaneseExceptions(map);
      break;
    case "euc-jp":
      for (let code = 0xff61; code <= 0xff9f; code++) {
        map.set(code, packBytes([0x8e, code - 0xff61 + 0xa1]));
      }
      japaneseExceptions(map);
      break;
    case "gb18030":
      // A3 A0 decodes to U+3000 for deployed content, so U+E5E5 cannot round-trip.
      map.delete(0xe5e5);
      for (const [code, lead, trail] of GB18030_PUA) {
        map.set(code, packBytes([lead, trail]));
      }
      break;
  }
}

const reverseMaps = new WeakMap<TextDecoding, () => Map<number, number>>();

/** Test access to an East Asian decoding's reverse map, building it if needed. */
export function reverseMapOf(
  decoding: TextDecoding,
): ReadonlyMap<number, number> | undefined {
  return reverseMaps.get(decoding)?.();
}

export function eastAsianDecoding(id: EastAsianEncoding): TextDecoding {
  const family = FAMILIES[id];
  const decoder = fatalDecoder(id);
  const rule: Rule = {
    lookbehind: 64,
    lookahead: family.lookahead,
    decoder,
    failLength: 1,
    asciiFastPath: true,
    resync(window, { before }) {
      for (let j = before - 1; j >= 0; j--) {
        if ((window[j] as number) < family.syncBelow) return j + 1;
      }
      // Best effort: with no sync byte in reach, rows may disagree on a
      // glyph that straddles them.
      return 0;
    },
    lengthAt: family.lengthAt,
  };

  let reverse: Map<number, number> | undefined;
  const build = () => {
    if (reverse) return reverse;
    const map = new Map<number, number>();
    family.buildReverse((bytes) => {
      const text = decodeWith(decoder, Uint8Array.from(bytes));
      if (text === null) return;
      const code = text.codePointAt(0) as number;
      // The Big5 pairs with a combining mark have no single code point to map.
      if (text.length !== (code > 0xffff ? 2 : 1)) return;
      const lastWins = id === "big5" && BIG5_LAST.has(code);
      if (lastWins || !map.has(code)) map.set(code, packBytes(bytes));
    });
    applyExceptions(id, map);
    reverse = map;
    return map;
  };

  const decoding = multiByte(
    rule,
    (text) => {
      if (hasLoneSurrogate(text)) return null;
      const map = build();
      const out: number[] = [];
      for (const char of text) {
        const code = char.codePointAt(0) as number;
        if (code < 0x80) {
          out.push(code);
          continue;
        }
        const packed = map.get(code);
        if (packed !== undefined) unpack(packed, out);
        else if (id === "gb18030" && code >= 0x10000)
          gb18030Supplementary(code, out);
        else return null;
      }
      return Uint8Array.from(out);
    },
    () => {
      build();
    },
  );
  reverseMaps.set(decoding, build);
  return decoding;
}
