/** The names of palette colours 0–15, as in the `--ansi-<name>` theme tokens. */
export const PALETTE_NAMES = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "bright-black",
  "bright-red",
  "bright-green",
  "bright-yellow",
  "bright-blue",
  "bright-magenta",
  "bright-cyan",
  "bright-white",
] as const;

const CUBE = [0, 95, 135, 175, 215, 255];

/**
 * xterm's fixed value for palette colour 16–255: the 6×6×6 cube, then 24
 * greys. Colours 0–15 belong to the theme, so they have no fixed value.
 */
export function xterm256(index: number): { r: number; g: number; b: number } {
  if (!Number.isInteger(index) || index < 16 || index > 255) {
    throw new RangeError(`xterm256: ${index} is not in 16–255`);
  }
  if (index >= 232) {
    const level = 8 + 10 * (index - 232);
    return { r: level, g: level, b: level };
  }
  const n = index - 16;
  return {
    r: CUBE[Math.floor(n / 36)] as number,
    g: CUBE[Math.floor(n / 6) % 6] as number,
    b: CUBE[n % 6] as number,
  };
}
