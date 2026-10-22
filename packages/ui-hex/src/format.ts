import { getTextDecoding, type HexEncoding } from "./encodings.ts";
import type { TextDecoding } from "./text-decoding.ts";
import type { HexPane } from "./types.ts";

export type { TextCell, TextDecoding } from "./text-decoding.ts";

const UPPER = Array.from({ length: 256 }, (_, b) =>
  b.toString(16).padStart(2, "0").toUpperCase(),
);
const LOWER = UPPER.map((s) => s.toLowerCase());

export function hexByte(byte: number, uppercase = true): string {
  return (uppercase ? UPPER : LOWER)[byte & 0xff] as string;
}

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

function decodingOf(encoding: HexEncoding | TextDecoding): TextDecoding {
  return typeof encoding === "string" ? getTextDecoding(encoding) : encoding;
}

/**
 * The source range `[from, to)` to read for copying `length` bytes at
 * `offset`: the selection widened by the encoding's lookbehind and lookahead,
 * so `copyText` writes its first and last glyphs as the text pane shows them.
 */
export function copyRange(
  offset: number,
  length: number,
  size: number,
  encoding: HexEncoding | TextDecoding = "ascii",
): { from: number; to: number } {
  const decoding = decodingOf(encoding);
  return {
    from: Math.max(0, offset - decoding.lookbehind),
    to: Math.min(size, offset + length + decoding.lookahead),
  };
}

/**
 * The clipboard text for a selection. `bytes` starts with `lead` bytes before
 * the selection and may run past it, as `copyRange` reads them; `offset` is
 * the source offset of the first selected byte, and `length` the selection's
 * length. The text pane's form decodes in `encoding`, ASCII like the view's
 * default.
 */
export function copyText(
  bytes: Uint8Array,
  pane: HexPane,
  uppercase = true,
  encoding: HexEncoding | TextDecoding = "ascii",
  lead = 0,
  offset = lead,
  length = bytes.length - lead,
): string {
  if (pane === "hex") {
    const parts: string[] = new Array(length);
    for (let i = 0; i < length; i++) {
      parts[i] = hexByte(bytes[lead + i] as number, uppercase);
    }
    return parts.join(" ");
  }
  let out = "";
  const row = { start: offset, before: lead, length };
  for (const cell of decodingOf(encoding).decodeRow(bytes, row, "dots")) {
    // A glyph is written whole by its first byte, even when its trailing
    // bytes lie past the selection; one starting before it is left out.
    if (cell.kind === "continuation") continue;
    out += cell.kind === "char" ? cell.text : ".";
  }
  return out;
}
