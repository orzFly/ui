import {
  converter,
  modeHsl,
  modeHsv,
  modeLrgb,
  modeOklab,
  modeOklch,
  modeP3,
  modeRgb,
  parse,
  useMode as registerMode,
  toGamut,
  wcagContrast,
} from "culori/fn";

registerMode(modeRgb);
registerMode(modeLrgb);
registerMode(modeOklab);
registerMode(modeOklch);
registerMode(modeP3);
registerMode(modeHsl);
registerMode(modeHsv);

const toOklch = converter("oklch");
const toRgb = converter("rgb");
const toP3 = converter("p3");
const toHsl = converter("hsl");
const toSrgbGamut = toGamut("rgb", "oklch");

export type ColorFormat = "oklch" | "hex" | "rgb" | "hsl";
export type Gamut = "srgb" | "p3" | "out";

/** l 0–1, c ≥ 0, h in degrees [0, 360) — 0 when the colour has no hue — alpha 0–1. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
  alpha: number;
}

export interface ParsedColor {
  color: Oklch;
  /** The syntax the text was written in, when it is one of the four; null otherwise. */
  format: ColorFormat | null;
}

function formatOf(text: string): ColorFormat | null {
  if (text.startsWith("#")) return "hex";
  if (text.startsWith("rgb(") || text.startsWith("rgba(")) return "rgb";
  if (text.startsWith("hsl(") || text.startsWith("hsla(")) return "hsl";
  if (text.startsWith("oklch(")) return "oklch";
  return null;
}

const unit = (v: number) => Math.min(1, Math.max(0, v));

function wrapHue(h: number): number {
  const wrapped = h % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function fromCulori(color: {
  l?: number;
  c?: number;
  h?: number;
  alpha?: number;
}): Oklch {
  return {
    l: unit(color.l ?? 0),
    c: color.c ?? 0,
    h: color.h === undefined || Number.isNaN(color.h) ? 0 : wrapHue(color.h),
    alpha: color.alpha ?? 1,
  };
}

function toCulori(color: Oklch) {
  return {
    mode: "oklch" as const,
    l: color.l,
    c: color.c,
    h: color.h,
    alpha: color.alpha,
  };
}

/** Any CSS colour culori parses; null for anything else, including the empty string. */
export function parseColor(text: string): ParsedColor | null {
  // CSS colour syntax is case-insensitive, culori's parser is not.
  const trimmed = text.trim().toLowerCase();
  if (trimmed === "") return null;
  const parsed = parse(trimmed);
  if (parsed === undefined) return null;
  const format = formatOf(trimmed);
  // CSS clamps rgb() channels and hsl() saturation and lightness when it parses them, culori
  // does not: unclamped, rgb(300 0 0) is a colour outside sRGB that maps back as salmon, not red.
  // color(srgb …) also parses to rgb, and CSS leaves that unclamped.
  let source = parsed;
  if (format === "rgb" && parsed.mode === "rgb")
    source = {
      ...parsed,
      r: unit(parsed.r),
      g: unit(parsed.g),
      b: unit(parsed.b),
    };
  else if (format === "hsl" && parsed.mode === "hsl")
    source = { ...parsed, s: unit(parsed.s), l: unit(parsed.l) };
  return { color: fromCulori(toOklch(source)), format };
}

// Converting a colour sitting exactly on the gamut's edge — every hex value — out of oklch and back
// lands a hair outside [0, 1]; without the slack, #ffffff would read as outside sRGB.
const EDGE = 1e-6;

function inUnitCube(color: { r: number; g: number; b: number }): boolean {
  return [color.r, color.g, color.b].every((v) => v >= -EDGE && v <= 1 + EDGE);
}

export function gamutOf(color: Oklch): Gamut {
  const culori = toCulori(color);
  if (inUnitCube(toRgb(culori))) return "srgb";
  if (inUnitCube(toP3(culori))) return "p3";
  return "out";
}

/** CSS Color 4 gamut mapping into sRGB; lightness and hue kept, alpha kept. */
export function mapToSrgb(color: Oklch): Oklch {
  if (gamutOf(color) === "srgb") return color;
  const mapped = fromCulori(toOklch(toSrgbGamut(toCulori(color))));
  return {
    ...mapped,
    h: mapped.c < 1e-4 ? color.h : mapped.h,
    alpha: color.alpha,
  };
}

/** Rounds to `digits` decimals and prints without trailing zeros or a trailing `.`. */
function num(value: number, digits: number): string {
  const rounded = Number(value.toFixed(digits));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

const byte = (v: number) => Math.round(unit(v) * 255);
const hex2 = (v: number) => v.toString(16).padStart(2, "0");

function srgbOf(color: Oklch) {
  const rgb = toRgb(toCulori(mapToSrgb(color)));
  return { r: unit(rgb.r), g: unit(rgb.g), b: unit(rgb.b) };
}

/**
 * The tokens' style: `oklch(0.577 0.245 27.325)`, `oklch(1 0 0 / 10%)`, `#18a46c`, `#18a46c80`,
 * `rgb(34 197 94 / 50%)`, `hsl(330 81% 60%)`. hex, rgb and hsl are mapped into sRGB first.
 * `alpha: false` omits alpha whatever the colour's alpha is. Default `alpha: true`.
 */
export function formatColor(
  color: Oklch,
  format: ColorFormat,
  options?: { alpha?: boolean },
): string {
  const withAlpha = options?.alpha ?? true;
  const percent = num(unit(color.alpha) * 100, 1);
  const alphaSuffix = withAlpha && percent !== "100" ? ` / ${percent}%` : "";
  switch (format) {
    case "oklch": {
      const h = num(color.h, 3);
      return `oklch(${num(color.l, 3)} ${num(color.c, 3)} ${h === "360" ? "0" : h}${alphaSuffix})`;
    }
    case "hex": {
      const { r, g, b } = srgbOf(color);
      const a = byte(color.alpha);
      return `#${hex2(byte(r))}${hex2(byte(g))}${hex2(byte(b))}${withAlpha && a < 255 ? hex2(a) : ""}`;
    }
    case "rgb": {
      const { r, g, b } = srgbOf(color);
      return `rgb(${byte(r)} ${byte(g)} ${byte(b)}${alphaSuffix})`;
    }
    case "hsl": {
      // Unquantised, a grey's channels differ in the last bits and hsl's saturation divides that
      // noise by nearly zero: white came out as `hsl(300 Infinity% 100%)`.
      const q = (v: number) => Math.round(v * 1e9) / 1e9;
      const { r, g, b } = srgbOf(color);
      const hsl = toHsl({ mode: "rgb", r: q(r), g: q(g), b: q(b) });
      const grey = hsl.s === 0 || !Number.isFinite(hsl.s);
      const h = num(grey || hsl.h === undefined ? 0 : hsl.h, 1);
      const s = grey ? 0 : hsl.s;
      return `hsl(${h === "360" ? "0" : h} ${num(s * 100, 1)}% ${num(hsl.l * 100, 1)}%${alphaSuffix})`;
    }
  }
}

/**
 * WCAG 2 ratio, 1–21. A translucent foreground is composited over the background first; the
 * background's alpha is ignored.
 */
export function contrastRatio(foreground: Oklch, background: Oklch): number {
  const fg = srgbOf(foreground);
  const bg = srgbOf(background);
  const a = unit(foreground.alpha);
  // Source-over in gamma-encoded sRGB, which is what a browser paints.
  const mix = (f: number, b: number) => f * a + b * (1 - a);
  return wcagContrast(
    { mode: "rgb", r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b) },
    { mode: "rgb", ...bg },
  );
}
