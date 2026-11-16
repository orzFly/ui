import {
  contrast,
  distance,
  labOf,
  painted,
  type Rgb,
  rgbOf,
  srgb,
} from "./rgb.ts";
import type { Tokens } from "./types.ts";

/** The share of `primary` in the fill of a palette that names no selection. */
const TINT = 0.25;
/** Selected text is text, so it is held to text's floor. */
const TEXT = 4.5;

/**
 * How far, in OKLab, the selected-text fill stands off each surface selected
 * text sits on. No WCAG floor covers it, so this one is the library's own. A
 * distance rather than a contrast ratio: a tint can differ from a grey fill
 * of its own lightness by hue alone, which a ratio does not see, and a fill
 * dark enough to make 3:1 against the page takes its text under 4.5:1.
 */
export const SELECTION_APART = 0.05;

/** The surfaces selected text sits on. */
export const SELECTION_SURFACES = [
  "background",
  "card",
  "popover",
  "muted",
  "sidebar",
] as const;

const hex = (rgb: Rgb) =>
  `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/**
 * The selected-text fill of a palette that names none: `seed` (an editor
 * theme's selection, `#rrggbbaa` included; absent, `primary` at 25% over the
 * page) laid over the page, then moved in OKLab lightness away from the page
 * until it stands {@link SELECTION_APART} off every surface of
 * `SELECTION_SURFACES`, or as far as `foreground` on it holds 4.5:1.
 */
export function selectionOf(
  tokens: Pick<
    Tokens,
    (typeof SELECTION_SURFACES)[number] | "primary" | "foreground"
  >,
  seed?: string,
): string {
  const ground = rgbOf(tokens.background);
  const ink = painted(tokens.foreground, ground);
  const primary = painted(tokens.primary, ground);
  const start: Rgb = seed
    ? overPage(seed, ground)
    : (ground.map((v, i) => v + (primary[i] - v) * TINT) as Rgb);
  const surfaces = SELECTION_SURFACES.map((name) =>
    painted(tokens[name], ground),
  );
  const [lightness, a, b] = labOf(start);
  // Darker on a light page, lighter on a dark one.
  const away = labOf(ground)[0] > 0.5 ? -0.005 : 0.005;
  let fill = start;
  for (let step = 1; step <= 100; step++) {
    if (surfaces.every((s) => distance(fill, s) >= SELECTION_APART)) break;
    const next = srgb([lightness + away * step, a, b]);
    if (contrast(ink, next) < TEXT) break;
    fill = next;
  }
  return hex(fill);
}

function overPage(value: string, ground: Rgb): Rgb {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(value);
  if (!m) return painted(value, ground);
  const alpha = Number.parseInt(m[2], 16) / 255;
  return rgbOf(`#${m[1]}`).map(
    (v, i) => v * alpha + ground[i] * (1 - alpha),
  ) as Rgb;
}
