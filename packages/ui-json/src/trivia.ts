const isBreak = (c: number) =>
  c === 0x0a || c === 0x0d || c === 0x2028 || c === 0x2029;

/**
 * Whether `text.slice(from, to)` holds only whitespace, commas and comments (`#` or `//` to the
 * end of the line, `/* … *\/`): what may stand between two places that read as one.
 */
export function onlyTrivia(text: string, from: number, to: number): boolean {
  let i = from;
  while (i < to) {
    const c = text.charCodeAt(i);
    if (c === 0x20 || c === 0x09 || c === 0x2c || isBreak(c)) {
      i++;
      continue;
    }
    const next = text.charCodeAt(i + 1);
    if (c === 0x23 || (c === 0x2f && next === 0x2f)) {
      while (i < to && !isBreak(text.charCodeAt(i))) i++;
      continue;
    }
    if (c === 0x2f && next === 0x2a) {
      const close = text.indexOf("*/", i + 2);
      if (close < 0 || close + 2 > to) return false;
      i = close + 2;
      continue;
    }
    return false;
  }
  return true;
}
