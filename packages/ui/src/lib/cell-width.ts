import { WIDE } from "./cell-width-table.ts";

const ZERO_WIDTH = /^[\p{Mn}\p{Me}]/u;
const EMOJI = /^\p{Emoji_Presentation}/u;

// Width + 1 per BMP code point, 0 until first asked: the property tests and
// the table search cost about 100 ns a call, which non-Latin text would pay
// on nearly every character.
let bmp: Uint8Array | undefined;

/**
 * How many terminal cells a code point takes. Code points are the unit, so a
 * ZWJ sequence counts each of its parts. C0 and C1 controls are the caller's:
 * they come back as 1.
 */
export function cellWidth(codePoint: number): 0 | 1 | 2 {
  if (codePoint < 0x300) return 1;
  if (codePoint > 0xffff) return lookUp(codePoint);
  bmp ??= new Uint8Array(0x10000);
  const known = bmp[codePoint];
  if (known !== 0) return (known - 1) as 0 | 1 | 2;
  const width = lookUp(codePoint);
  bmp[codePoint] = width + 1;
  return width;
}

function lookUp(codePoint: number): 0 | 1 | 2 {
  if (
    codePoint === 0x200d ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
  ) {
    return 0;
  }
  const char = String.fromCodePoint(codePoint);
  if (ZERO_WIDTH.test(char)) return 0;
  if (EMOJI.test(char)) return 2;
  let lo = 0;
  let hi = WIDE.length / 2 - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (codePoint < WIDE[mid * 2]) hi = mid - 1;
    else if (codePoint > WIDE[mid * 2 + 1]) lo = mid + 1;
    else return 2;
  }
  return 1;
}
