import type { ControlCodes, HexPane } from "./types.ts";

const UPPER = Array.from({ length: 256 }, (_, b) =>
  b.toString(16).padStart(2, "0").toUpperCase(),
);
const LOWER = UPPER.map((s) => s.toLowerCase());

export function hexByte(byte: number, uppercase = true): string {
  return (uppercase ? UPPER : LOWER)[byte & 0xff] as string;
}

export interface TextCell {
  kind: "char" | "control" | "dot" | "continuation";
  text?: string;
}

export interface TextDecoding {
  /** Bytes before the row start that decodeRow needs to resynchronise; 0 for single-byte encodings. */
  lookbehind: number;
  /** `bytes` is `lookbehind` bytes (fewer at the source start) followed by the row; returns one cell per row byte. */
  decodeRow(
    bytes: Uint8Array,
    rowStart: number,
    controlCodes: ControlCodes,
  ): TextCell[];
}

const CONTROL_NAMES =
  "NU SH SX EX ET EQ AK BL BS HT LF VT FF CR SO SI DL D1 D2 D3 D4 NK SY EB CN EM SB EC FS GS RS US".split(
    " ",
  );

export function controlName(byte: number): string | undefined {
  if (byte < 0x20) return CONTROL_NAMES[byte];
  return byte === 0x7f ? "DT" : undefined;
}

const DOT: TextCell = { kind: "dot" };

export const asciiDecoding: TextDecoding = {
  lookbehind: 0,
  decodeRow(bytes, _rowStart, controlCodes) {
    const cells: TextCell[] = new Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i] as number;
      if (b >= 0x20 && b < 0x7f) {
        cells[i] = { kind: "char", text: String.fromCharCode(b) };
      } else if (b < 0x80 && controlCodes === "abbreviations") {
        cells[i] = { kind: "control", text: controlName(b) };
      } else {
        cells[i] = DOT;
      }
    }
    return cells;
  },
};

export function addressDigits(lastAddress: number): number {
  return Math.max(4, Math.max(0, lastAddress).toString(16).length);
}

export function formatAddress(
  address: number,
  digits: number,
  uppercase = true,
): string {
  const s = address.toString(16).padStart(digits, "0");
  return uppercase ? s.toUpperCase() : s;
}

/** `0x5` / `0x5–0x25`: the short offset form used by the status bar and the inspector. */
export function formatOffset(offset: number): string {
  return `0x${offset.toString(16).toUpperCase()}`;
}

const UNITS = ["KB", "MB", "GB", "TB", "PB"];

export function formatSize(bytes: number): string {
  const hex = formatOffset(bytes);
  if (bytes < 1024)
    return `${bytes} ${bytes === 1 ? "byte" : "bytes"} (${hex})`;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${Number(value.toFixed(2))} ${UNITS[unit]} (${hex})`;
}

export const MAX_COPY_BYTES = 1 << 20;

/**
 * The clipboard text for a selection. `bytes` starts with `lead` bytes before
 * the selection, which a decoder with lookbehind needs; `offset` is the
 * source offset of the first selected byte.
 */
export function copyText(
  bytes: Uint8Array,
  pane: HexPane,
  uppercase = true,
  decoding: TextDecoding = asciiDecoding,
  lead = 0,
  offset = lead,
): string {
  if (pane === "hex") {
    const parts: string[] = new Array(bytes.length - lead);
    for (let i = lead; i < bytes.length; i++) {
      parts[i - lead] = hexByte(bytes[i] as number, uppercase);
    }
    return parts.join(" ");
  }
  let out = "";
  for (const cell of decoding.decodeRow(bytes, offset, "dots")) {
    // A multi-byte glyph is written once, by its first cell.
    if (cell.kind === "continuation") continue;
    out += cell.kind === "char" ? cell.text : ".";
  }
  return out;
}
