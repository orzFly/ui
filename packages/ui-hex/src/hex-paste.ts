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
