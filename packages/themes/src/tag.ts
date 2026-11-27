import {
  contrast,
  type Lab,
  labOf,
  linearSrgb,
  oklab,
  type Rgb,
  rgbOf,
  srgb,
} from "./rgb.ts";
import type { ColorScheme, Tokens } from "./types.ts";

/** The named tag colours, in this order; `autoTagColor` picks among all but `gray`. */
export const TAG_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
  "gray",
] as const;
export type TagColor = (typeof TAG_COLORS)[number];
export type TagTokenName = `tag-${TagColor}`;
type Chromatic = Exclude<TagColor, "gray">;

/** Each chromatic colour's base hue, in OKLCH degrees. */
export const TAG_HUES: Readonly<Record<Chromatic, number>> = {
  red: 25,
  orange: 55,
  yellow: 88,
  green: 148,
  teal: 190,
  blue: 255,
  purple: 300,
  pink: 350,
};

const RING = Object.entries(TAG_HUES) as [Chromatic, number][];

/** The share of a tag's colour in its fill, mixed into `background` in OKLab. */
export const TAG_FILL: Readonly<Record<ColorScheme, number>> = {
  light: 0.16,
  dark: 0.24,
};

/** WCAG AA for normal-size text. */
const TEXT = 4.5;
/** What `tagColorsOf` solves for: 4.5:1 and headroom for a value blended toward gray. */
const SOLVED = 4.65;
/** The most chroma a derived colour takes; a dark page's tints glare sooner. */
const CHROMA: Readonly<Record<ColorScheme, number>> = {
  light: 0.16,
  dark: 0.13,
};
/** `gray` keeps the foreground's tint, never more than this. */
const GRAY_CHROMA = 0.02;
/** Where the lightness search starts, stepping toward the page's opposite. */
const LIGHTNESS: Readonly<Record<ColorScheme, number>> = {
  light: 0.62,
  dark: 0.72,
};
const STEP = 0.005;
/** A colour value with less chroma than this is drawn as `gray`. */
const NEUTRAL = 0.01;
/** A colour value's chroma at which it keeps its hue whole; below, it leans toward `gray`. */
const FULL = 0.1;

const round = (v: number) => Math.round(v * 1e3) / 1e3;
const radians = (degrees: number) => (degrees * Math.PI) / 180;
const hex = (rgb: Rgb) =>
  `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** An opaque `oklch(L C H)` or `#rrggbb` in OKLab, unrounded where it is written as `oklch()`. */
export function labOfValue(value: string): Lab {
  return value.startsWith("oklch(") ? oklab(value) : labOf(rgbOf(value));
}

/** OKLab as [lightness, chroma, hue in degrees]. */
export function lchOf([lightness, a, b]: Lab): Lab {
  const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return [lightness, Math.hypot(a, b), hue];
}

function labOfLch([lightness, chroma, hue]: Lab): Lab {
  return [
    lightness,
    chroma * Math.cos(radians(hue)),
    chroma * Math.sin(radians(hue)),
  ];
}

/** `amount` (0–1) of `to` over `from`, as `color-mix(in oklab, …)` mixes. */
export function mixOklab(from: Lab, to: Lab, amount: number): Lab {
  return from.map((v, i) => v + (to[i] - v) * amount) as Lab;
}

/**
 * `amount` (0–1) of `to` over `from`, as `color-mix(in oklch, …)` mixes:
 * lightness and chroma straight, hue the shorter way round.
 */
export function mixOklch(from: Lab, to: Lab, amount: number): Lab {
  const [l1, c1, h1] = lchOf(from);
  const [l2, c2, h2] = lchOf(to);
  let turn = h2 - h1;
  if (turn > 180) turn -= 360;
  if (turn < -180) turn += 360;
  return labOfLch([
    l1 + (l2 - l1) * amount,
    c1 + (c2 - c1) * amount,
    (h1 + turn * amount + 360) % 360,
  ]);
}

const inGamut = (lab: Lab) =>
  linearSrgb(lab).every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** The most chroma, in thousandths and up to `cap`, this lightness and hue hold inside sRGB. */
function gamutChroma(lightness: number, hue: number, cap: number): number {
  const fits = (thousandths: number) =>
    inGamut(labOfLch([lightness, thousandths / 1e3, hue]));
  let low = 0;
  let high = Math.floor(cap * 1e3 + 1e-9);
  if (fits(high)) return high / 1e3;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return low / 1e3;
}

/** The fill a tag of colour `ink` is drawn on, as `#rrggbb`. */
export function tagFill(
  ink: string,
  background: string,
  scheme: ColorScheme,
): string {
  return hex(srgb(fillOf(labOfValue(ink), labOfValue(background), scheme)));
}

function fillOf(ink: Lab, ground: Lab, scheme: ColorScheme): Lab {
  return mixOklab(ground, ink, TAG_FILL[scheme]);
}

/** How a tag of colour `ink` reads on its own fill over `ground`, as the browser clips both to sRGB. */
export function onFill(ink: Lab, ground: Lab, scheme: ColorScheme): number {
  return contrast(srgb(ink), srgb(fillOf(ink, ground, scheme)));
}

/**
 * A colour value's ink as `tagInk` writes it in CSS: `toShare` (0–1) of the
 * way from `from` to `to` in OKLCH, then `grayShare` (0–1) toward `gray` in
 * OKLab.
 */
export function blendOf(
  from: Lab,
  to: Lab,
  gray: Lab,
  toShare: number,
  grayShare: number,
): Lab {
  return mixOklab(mixOklch(from, to, toShare), gray, grayShare);
}

/**
 * The tag colours, each from `LIGHTNESS` stepped away from the page until it
 * reads at {@link SOLVED} on its own fill. Two hue-adjacent colours blend
 * through hues sRGB cannot hold at their chroma, and the clipped blend reads
 * lighter than either end: while any blend of a pair, every tenth of the way,
 * falls under 4.5:1, both colours step on together.
 */
function solve(
  hues: Readonly<Record<TagColor, number>>,
  caps: Readonly<Record<TagColor, number>>,
  ground: Lab,
  scheme: ColorScheme,
): Record<TagTokenName, string> {
  const away = scheme === "dark" ? STEP : -STEP;
  const within = (l: number) => l >= 0 && l <= 1;
  // Each value as written, at three decimals.
  const lch = (color: TagColor, l: number): Lab => {
    const hue = round(hues[color]);
    return [l, gamutChroma(l, hue, caps[color]), hue];
  };
  const lab = (color: TagColor, l: number) => labOfLch(lch(color, l));
  const level = {} as Record<TagColor, number>;
  for (const color of TAG_COLORS) {
    let l = LIGHTNESS[scheme];
    while (
      within(round(l + away)) &&
      onFill(lab(color, l), ground, scheme) < SOLVED
    ) {
      l = round(l + away);
    }
    level[color] = l;
  }
  const holds = (from: Chromatic, to: Chromatic) => {
    const [a, b] = [lab(from, level[from]), lab(to, level[to])];
    for (let share = 1; share < 10; share++) {
      const ink = mixOklch(a, b, share / 10);
      if (onFill(ink, ground, scheme) < TEXT) return false;
    }
    return true;
  };
  for (const [index, [from]] of RING.entries()) {
    const [to] = RING[(index + 1) % RING.length];
    while (
      !holds(from, to) &&
      within(round(level[from] + away)) &&
      within(round(level[to] + away))
    ) {
      level[from] = round(level[from] + away);
      level[to] = round(level[to] + away);
    }
  }
  return Object.fromEntries(
    TAG_COLORS.map((color) => {
      const [l, c, h] = lch(color, level[color]);
      return [`tag-${color}`, `oklch(${l} ${c} ${h})`];
    }),
  ) as Record<TagTokenName, string>;
}

/**
 * The nine tag colours of a palette that names none. Each chromatic colour
 * keeps its `TAG_HUES` hue and takes as much chroma as the scheme's cap and
 * sRGB allow; `gray` takes the foreground's hue and at most a trace of its
 * chroma. The lightness starts mid-way and steps away from the page until
 * the colour reads at 4.65:1 on its own fill, which leaves room for a colour
 * value blended toward gray, and further while it blends with a neighbour
 * under 4.5:1.
 */
export function tagColorsOf(
  tokens: Pick<Tokens, "background" | "foreground">,
  scheme: ColorScheme,
): Record<TagTokenName, string> {
  const [, chroma, hue] = lchOf(labOfValue(tokens.foreground));
  const caps = Object.fromEntries(
    TAG_COLORS.map((color) => [color, CHROMA[scheme]]),
  ) as Record<TagColor, number>;
  caps.gray = Math.min(GRAY_CHROMA, chroma);
  return solve(
    { ...TAG_HUES, gray: hue },
    caps,
    labOfValue(tokens.background),
    scheme,
  );
}

/**
 * Where a colour of this hue and chroma falls among the named ones: `gray`, or
 * between two hue-adjacent colours, `toShare` percent of the way from `from` to `to`,
 * then `grayShare` percent toward gray. Shares are whole percents.
 */
export type TagBlend =
  | "gray"
  | {
      from: Chromatic;
      to: Chromatic;
      toShare: number;
      grayShare: number;
    };

export function tagBlend(hue: number, chroma: number): TagBlend {
  if (chroma < NEUTRAL) return "gray";
  const turn = ((hue % 360) + 360) % 360;
  // Below red's hue, the colour sits between pink and red, across 0°.
  const index = RING.findLastIndex(([, base]) => base <= turn);
  const [from, start] = RING.at(index) as [Chromatic, number];
  const [to, next] = RING[(index + 1) % RING.length];
  const span = (next - start + 360) % 360;
  const along = (turn - start + 360) % 360;
  return {
    from,
    to,
    toShare: Math.round((along / span) * 100),
    grayShare: Math.round(Math.min(1, Math.max(0, 1 - chroma / FULL)) * 100),
  };
}
