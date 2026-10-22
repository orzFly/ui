import type { HexPane } from "./types.ts";

// Separators and notation from the dumps people copy: `89 50`, `0x89, 0x50`,
// `{ 0x89, 0x50 }`, `[0x89;0x50]`, `\x89\x50`.
const NOISE = /0x|\\x|[\s,;[\]{}()]/gi;
const HEX = /^[0-9a-f]*$/i;

/**
 * The bytes in a hex dump pasted as text; `null` when anything but hex
 * digits and separators remains, or the digits do not pair up.
 */
export function parseHexText(text: string): Uint8Array | null {
  const digits = text.replace(NOISE, "");
  if (!HEX.test(digits) || digits.length % 2 !== 0) return null;
  const bytes = new Uint8Array(digits.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(digits.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * The clipboard type a copy writes the exact bytes under, as hex digits,
 * beside its text: the text pane's text shows a byte it cannot decode as a
 * dot, which pastes back as `2E`.
 */
export const HEX_BYTES_TYPE = "application/x-orz-hex";

export function hexDigits(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

/** What one clipboard write holds: its text, and the exact bytes when they rode along. */
export interface HexClipboard {
  text: string;
  /** The `HEX_BYTES_TYPE` data; empty or absent when the copy carried text only. */
  bytes?: string;
}

/**
 * The bytes a paste of `clipboard` into `pane` writes: the exact bytes when
 * they rode along, else the text read as a hex dump or encoded; `null` when
 * the text is neither.
 */
export function clipboardBytes(
  clipboard: HexClipboard,
  pane: HexPane,
  encode: (text: string) => Uint8Array | null,
): Uint8Array | null {
  const exact = clipboard.bytes ? parseHexText(clipboard.bytes) : null;
  if (exact) return exact;
  return pane === "hex" ? parseHexText(clipboard.text) : encode(clipboard.text);
}
