import { contrast, painted, type Rgb, rgbOf } from "./rgb.ts";
import type { Tokens } from "./types.ts";

/** About the share of `primary` the Default palette's own square holds over its fill. */
const TINT = 0.12;
/** The marker's icon is text-sized, so it is held to text's floor. */
const ICON = 4.5;

const hex = (rgb: Rgb) =>
  `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/**
 * The module marker's square for a palette that names none: `primary` mixed
 * into `muted`, the header strip the square sits on, at 12%, or less where
 * that would leave the `primary` icon on it under 4.5:1. Where `primary` on
 * `muted` is already under it, the square steps from `muted` toward black or
 * white, whichever the icon stands out from, until it holds.
 */
export function markerOf(
  tokens: Pick<Tokens, "primary" | "muted" | "background">,
): string {
  const ground = rgbOf(tokens.background);
  const fill = painted(tokens.muted, ground);
  const ink = painted(tokens.primary, ground);
  const mix = (to: Rgb, amount: number) =>
    fill.map((v, i) => Math.round(v + (to[i] - v) * amount)) as Rgb;
  for (let step = Math.round(TINT * 100); step >= 0; step--) {
    const tint = mix(ink, step / 100);
    if (contrast(ink, tint) >= ICON) return hex(tint);
  }
  // Not even the bare fill holds the icon: step the square away from it.
  const away: Rgb =
    contrast(ink, [0, 0, 0]) > contrast(ink, [255, 255, 255])
      ? [0, 0, 0]
      : [255, 255, 255];
  for (let step = 1; step < 100; step++) {
    const square = mix(away, step / 100);
    if (contrast(ink, square) >= ICON) return hex(square);
  }
  return hex(away);
}
