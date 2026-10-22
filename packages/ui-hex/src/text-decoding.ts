import type { ControlCodes } from "./types.ts";

export interface TextCell {
  kind: "char" | "control" | "dot" | "continuation";
  text?: string;
  /** On a glyph's first byte: how many bytes the glyph covers, possibly running past the row end. */
  length?: number;
  /** On a continuation: the absolute offset of the glyph's first byte, possibly on an earlier row. */
  lead?: number;
}

export interface TextRow {
  /** The source offset of the row's first byte. */
  start: number;
  /** How many window bytes come before the row. */
  before: number;
  /** How many bytes the row has. */
  length: number;
}

export interface TextDecoding {
  /** Bytes before the row start needed to resynchronise; 0 for single-byte encodings. */
  lookbehind: number;
  /** Bytes after the row end needed to finish a glyph that starts on the row; 0 for single-byte. */
  lookahead: number;
  /**
   * `window` is up to `lookbehind` bytes, then the row's `length` bytes, then
   * up to `lookahead` bytes; fewer at either end of the source. Returns
   * exactly `row.length` cells, one per row byte.
   */
  decodeRow(
    window: Uint8Array,
    row: TextRow,
    controlCodes: ControlCodes,
  ): TextCell[];
  /** The bytes an editor writes for typed or pasted text; `null` when any character has none. */
  encode?(text: string): Uint8Array | null;
  /** Builds whatever `encode` needs ahead of the first call; a no-op where nothing is built. */
  prepareEncode?(): void;
}

const CONTROL_NAMES =
  "NU SH SX EX ET EQ AK BL BS HT LF VT FF CR SO SI DL D1 D2 D3 D4 NK SY EB CN EM SB EC FS GS RS US".split(
    " ",
  );

export function controlName(code: number): string | undefined {
  if (code < 0x20) return CONTROL_NAMES[code];
  return code === 0x7f ? "DT" : undefined;
}

// C1, format characters, combining marks (which would merge into the previous
// cell's glyph), separators, private use, unassigned, lone surrogates, U+FFFD.
const NO_GLYPH =
  /^[\p{Cc}\p{Cf}\p{Mn}\p{Me}\p{Zl}\p{Zp}\p{Co}\p{Cn}\p{Cs}\u{FFFD}]/u;

/** The cell a decoded character shows as; `length` is the caller's. */
export function classify(text: string, controlCodes: ControlCodes): TextCell {
  const code = text.codePointAt(0) ?? 0xfffd;
  if (code < 0x20 || code === 0x7f) {
    return controlCodes === "abbreviations"
      ? { kind: "control", text: controlName(code) }
      : { kind: "dot" };
  }
  if (NO_GLYPH.test(text)) return { kind: "dot" };
  return { kind: "char", text };
}

// East Asian Wide and Fullwidth, a subset of EastAsianWidth.txt.
const WIDE: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xa960, 0xa97f],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1b000, 0x1b2ff],
  [0x20000, 0x3fffd],
];
const EMOJI = /\p{Emoji_Presentation}/u;

/** How many text cells a glyph is drawn across, without measuring it. */
export function glyphCells(text: string): number {
  if (EMOJI.test(text)) return 2;
  const code = text.codePointAt(0) ?? 0;
  for (const [from, to] of WIDE) {
    if (code < from) return 1;
    if (code <= to) return 2;
  }
  return 1;
}

const LONE_SURROGATE = /\p{Cs}/u;

/** `TextEncoder` and the code-unit encoders would otherwise write a lone surrogate silently. */
export function hasLoneSurrogate(text: string): boolean {
  return LONE_SURROGATE.test(text);
}

type CellTables = readonly [
  abbreviations: readonly TextCell[],
  dots: readonly TextCell[],
];

function cellTables(decode: (byte: number) => string): CellTables {
  const abbreviations: TextCell[] = [];
  const dots: TextCell[] = [];
  for (let byte = 0; byte < 256; byte++) {
    const text = decode(byte);
    abbreviations[byte] = { ...classify(text, "abbreviations"), length: 1 };
    dots[byte] = { ...classify(text, "dots"), length: 1 };
  }
  return [abbreviations, dots];
}

function singleByte(
  tables: () => CellTables,
  encode: (text: string) => Uint8Array | null,
): TextDecoding {
  return {
    lookbehind: 0,
    lookahead: 0,
    decodeRow(window, row, controlCodes) {
      const cells = tables()[controlCodes === "dots" ? 1 : 0];
      const out: TextCell[] = new Array(row.length);
      for (let i = 0; i < row.length; i++) {
        out[i] = cells[window[row.before + i] as number] as TextCell;
      }
      return out;
    },
    encode,
  };
}

function lazy<T>(build: () => T): () => T {
  let value: T | undefined;
  return () => {
    value ??= build();
    return value;
  };
}

function encodeBelow(limit: number) {
  return (text: string): Uint8Array | null => {
    const out: number[] = [];
    for (const char of text) {
      const code = char.codePointAt(0) as number;
      if (code >= limit) return null;
      out.push(code);
    }
    return Uint8Array.from(out);
  };
}

export const asciiDecoding: TextDecoding = singleByte(
  lazy(() =>
    cellTables((byte) =>
      byte < 0x80 ? String.fromCharCode(byte) : "\u{FFFD}",
    ),
  ),
  encodeBelow(0x80),
);

// Computed: TextDecoder("iso-8859-1") is Windows-1252 under the Encoding Standard.
export const latin1Decoding: TextDecoding = singleByte(
  lazy(() => cellTables((byte) => String.fromCharCode(byte))),
  encodeBelow(0x100),
);

/** A single-byte encoding `TextDecoder` knows, built from one decode per byte on first use. */
export function tableDecoding(label: string): TextDecoding {
  const built = lazy(() => {
    const decoder = new TextDecoder(label);
    const chars: string[] = [];
    const reverse = new Map<string, number>();
    for (let byte = 0; byte < 256; byte++) {
      const char = decoder.decode(Uint8Array.of(byte));
      chars[byte] = char;
      // The lower byte wins a duplicate; an undefined byte encodes nothing.
      if (char !== "\u{FFFD}" && !reverse.has(char)) reverse.set(char, byte);
    }
    return { tables: cellTables((byte) => chars[byte] as string), reverse };
  });
  return singleByte(
    () => built().tables,
    (text) => {
      const { reverse } = built();
      const out: number[] = [];
      for (const char of text) {
        const byte = reverse.get(char);
        if (byte === undefined) return null;
        out.push(byte);
      }
      return Uint8Array.from(out);
    },
  );
}
