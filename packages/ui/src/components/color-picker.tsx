import { converter } from "culori/fn";
import {
  LockIcon,
  LockOpenIcon,
  PipetteIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Slider as SliderPrimitive } from "radix-ui";
import type * as React from "react";
import type { ReactElement, ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  type ColorFormat,
  contrastRatio,
  type DisplayGamut,
  formatColor,
  gamutOf,
  mapToSrgb,
  maxChroma,
  type Oklch,
  parseColor,
} from "../lib/color.ts";
import { cn } from "../lib/utils.ts";
import { Button } from "./button.tsx";
import { Input } from "./input.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.tsx";

// The modes these converters need are registered by ../lib/color.ts, imported above.
const toRgb = converter("rgb");
const toP3 = converter("p3");
const toHsv = converter("hsv");
const toHsl = converter("hsl");
const toOklch = converter("oklch");

export type ColorSurface = "oklch" | "absolute" | "hsv";

export interface SwatchGroup {
  label: string;
  colors: readonly string[];
}

export interface ColorPickerProps {
  value: string;
  onValueChange?: (value: string) => void;
  onValueCommit?: (value: string) => void;
  /** Pins the output format. Default: the value's own format, else oklch. */
  format?: ColorFormat;
  /** Default true. */
  alpha?: boolean;
  /** Default ["oklch", "absolute", "hsv"]; one entry hides the toggle. */
  surfaces?: readonly ColorSurface[];
  surface?: ColorSurface;
  defaultSurface?: ColorSurface;
  onSurfaceChange?: (surface: ColorSurface) => void;
  /** Bounds the oklch surface and the chroma lock. Default "srgb". */
  gamut?: DisplayGamut;
  /** Shows a reset button when it parses; clicking commits it. */
  resetValue?: string;
  /** Keep C / maxChroma while hue or lightness changes from the hue slider or the L/H fields. */
  chromaLock?: boolean;
  /** Default false. */
  defaultChromaLock?: boolean;
  onChromaLockChange?: (locked: boolean) => void;
  swatches?: readonly string[] | readonly SwatchGroup[];
  contrastWith?: string;
  /** Default "background". */
  contrastLabel?: string;
  /** Default true; the button still only appears where window.EyeDropper exists. */
  eyeDropper?: boolean;
  disabled?: boolean;
  className?: string;
  /** Rendered at the bottom of the panel. */
  extra?: ReactNode;
}

const ALL_SURFACES: readonly ColorSurface[] = ["oklch", "absolute", "hsv"];
const SURFACE_LABELS: Record<ColorSurface, string> = {
  oklch: "OKLCH",
  absolute: "Absolute",
  hsv: "HSV",
};
// A token written to three decimals on its gamut's edge can read a hair past it; that is not
// beyond the edge.
const PIN_SLACK = 1e-3;
// The absolute surface past P3: the row's edge colour with its chroma cut and its lightness pulled
// toward the middle, so the region reads as "not here" rather than as more colours.
const FADE = 0.38;
const FADE_L0 = 0.2;
const FADE_L1 = 0.72;
// Converting through sRGB lands a grey a hair off the axis; below this it has no hue to trust.
const ACHROMATIC = 1e-4;
const EDGE = 1e-6;

const BLACK: Oklch = { l: 0, c: 0, h: 0, alpha: 1 };

const CHECKERBOARD: React.CSSProperties = {
  backgroundImage: "conic-gradient(#ccc 25%, #fff 0 50%, #ccc 0 75%, #fff 0)",
  backgroundSize: "8px 8px",
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const wrapHue = (h: number) => ((h % 360) + 360) % 360;
const round = (v: number, digits: number) => String(Number(v.toFixed(digits)));

function css(color: Oklch, alpha = color.alpha): string {
  return `oklch(${color.l} ${color.c} ${color.h} / ${alpha})`;
}

function culoriOf(color: Oklch) {
  return { mode: "oklch" as const, ...color };
}

/** An sRGB colour as oklch, keeping `hue` when it comes out achromatic. */
function oklchOfRgb(
  rgb: { r: number; g: number; b: number },
  hue: number,
  alpha: number,
): Oklch {
  const o = toOklch({ mode: "rgb", ...rgb });
  const c = o.c ?? 0;
  return {
    l: clamp(o.l ?? 0, 0, 1),
    c,
    h: c < ACHROMATIC || o.h === undefined ? hue : wrapHue(o.h),
    alpha,
  };
}

function srgbOf(color: Oklch) {
  const rgb = toRgb(culoriOf(mapToSrgb(color)));
  return {
    r: clamp(rgb.r, 0, 1),
    g: clamp(rgb.g, 0, 1),
    b: clamp(rgb.b, 0, 1),
  };
}

interface HsvHold {
  h: number;
  s: number;
}

/**
 * HSV of the colour. A grey has no HSV hue, and black no saturation either; `hold` carries what
 * the HSV surface last set, so the thumb does not jump when the colour passes through them.
 */
function hsvOf(color: Oklch, hold: HsvHold | null) {
  const raw = toHsv({ mode: "rgb", ...srgbOf(color) });
  let h = hold?.h ?? raw.h;
  if (h === undefined || Number.isNaN(h)) {
    // No hold and no hue: borrow the oklch hue, so switching surfaces keeps the hue the user set.
    h = toHsv(toRgb(culoriOf({ l: 0.7, c: 0.1, h: color.h, alpha: 1 }))).h ?? 0;
  }
  return { h: wrapHue(h), s: hold?.s ?? raw.s, v: raw.v };
}

function fromHsv(h: number, s: number, v: number, prev: Oklch): Oklch {
  const rgb = toRgb({ mode: "hsv", h, s, v });
  return oklchOfRgb(
    { r: clamp(rgb.r, 0, 1), g: clamp(rgb.g, 0, 1), b: clamp(rgb.b, 0, 1) },
    prev.h,
    prev.alpha,
  );
}

function inUnit(c: { r: number; g: number; b: number }) {
  return (
    c.r >= -EDGE &&
    c.r <= 1 + EDGE &&
    c.g >= -EDGE &&
    c.g <= 1 + EDGE &&
    c.b >= -EDGE &&
    c.b <= 1 + EDGE
  );
}

const byte = (v: number) => Math.round(clamp(v, 0, 1) * 255);

function supportsP3(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(color-gamut: p3)").matches
  );
}

/** A 2D context in Display P3 when the display is P3 and the canvas accepts it. */
function context2d(canvas: HTMLCanvasElement, p3: boolean) {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext(
      "2d",
      p3 ? { colorSpace: "display-p3" } : undefined,
    );
  } catch {
    // happy-dom and older engines: no canvas, or no colour space option.
  }
  if (ctx === null) return null;
  const space = p3 ? ctx.getContextAttributes?.().colorSpace : "srgb";
  return { ctx, p3: space === "display-p3" };
}

const axisCache = new Map<number, number>();

/**
 * The absolute surface's chroma axis at a hue: a little past the largest P3 chroma the hue reaches
 * at any lightness, so the hue's whole P3 wedge spans the width. Cached per 0.1° — at most 3600
 * entries — because finding it takes milliseconds and a hue drag asks every frame.
 */
function axisMax(hue: number): number {
  const key = Math.round(wrapHue(hue) * 10) % 3600;
  const hit = axisCache.get(key);
  if (hit !== undefined) return hit;
  const h = key / 10;
  let bestL = 0.5;
  let best = 0;
  for (let l = 0.005; l < 1; l += 0.005) {
    const c = maxChroma(l, h, "p3");
    if (c > best) {
      best = c;
      bestL = l;
    }
  }
  // Chroma rises to one cusp and falls, so a ternary search around the best sample finds its top.
  let a = Math.max(0.001, bestL - 0.005);
  let b = Math.min(0.999, bestL + 0.005);
  for (let k = 0; k < 30; k++) {
    const m1 = a + (b - a) / 3;
    const m2 = b - (b - a) / 3;
    if (maxChroma(m1, h, "p3") < maxChroma(m2, h, "p3")) a = m1;
    else b = m2;
  }
  const peak = Math.max(best, maxChroma((a + b) / 2, h, "p3"));
  const max = peak * 1.05;
  axisCache.set(key, max);
  return max;
}

/**
 * Where a colour sits on the oklch surface: C as a share of the gamut's largest chroma at its
 * lightness and hue. A grey at L = 0 or 1, where that largest chroma is 0, is 0; a colour with
 * chroma there is infinitely far past the edge.
 */
function relativeOf(color: Oklch, gamut: DisplayGamut): number {
  const max = maxChroma(color.l, color.h, gamut);
  if (max > 0) return color.c / max;
  return color.c < ACHROMATIC ? 0 : Number.POSITIVE_INFINITY;
}

/**
 * The chroma lock: `next` with its C recomputed so that C / maxChroma stays what it was in `prev`,
 * or what the oklch surface holds in `rel`. A colour beyond the gamut keeps its C, so the lock does
 * not amplify the overshoot.
 */
function lockChroma(
  prev: Oklch,
  next: Oklch,
  gamut: DisplayGamut,
  rel: number | null,
): { color: Oklch; rel: number | null } {
  const r = rel ?? relativeOf(prev, gamut);
  if (r > 1 + PIN_SLACK) return { color: next, rel: null };
  const kept = Math.min(r, 1);
  return {
    color: { ...next, c: kept * maxChroma(next.l, next.h, gamut) },
    rel: kept,
  };
}

/** One RGBA image the size of the canvas, in the canvas's colour space. */
function imageFor(canvas: HTMLCanvasElement, wantP3: boolean) {
  const target = context2d(canvas, wantP3);
  if (target === null) return null;
  const { ctx, p3 } = target;
  const w = canvas.width;
  const h = canvas.height;
  if (w < 2 || h < 2) return null;
  const image = ctx.createImageData(w, h, {
    colorSpace: p3 ? "display-p3" : "srgb",
  });
  const show = (pixel: { mode: "oklch"; l: number; c: number; h: number }) =>
    channels(p3 ? toP3(pixel) : toRgb(pixel));
  const put = (i: number, out: number[]) => {
    image.data[i] = byte(out[0]);
    image.data[i + 1] = byte(out[1]);
    image.data[i + 2] = byte(out[2]);
    image.data[i + 3] = 255;
  };
  return { ctx, p3, w, h, image, show, put };
}

// Pixels are sampled at their centres, so the painted surface agrees with the thumb and the edge
// lines, which put L = 1 on the top border and C = 0 on the left one.
const rowLightness = (y: number, rows: number) => 1 - (y + 0.5) / rows;
const columnShare = (x: number, columns: number) => (x + 0.5) / columns;

/**
 * Paints lightness × relative chroma at one hue: each row runs from grey to the gamut's edge at
 * that lightness, so every pixel is a colour the gamut holds. With a P3 gamut, the band past sRGB
 * is the real P3 colour on a P3 canvas, else the row's sRGB edge colour.
 */
function paintRelative(
  canvas: HTMLCanvasElement,
  hue: number,
  gamut: DisplayGamut,
  wantP3: boolean,
) {
  const target = imageFor(canvas, wantP3);
  if (target === null) return;
  const { ctx, p3, w, h, image, show, put } = target;
  const pixel = { mode: "oklch" as const, l: 0, c: 0, h: hue };
  for (let y = 0; y < h; y++) {
    pixel.l = rowLightness(y, h);
    const span = maxChroma(pixel.l, hue, gamut);
    const cs = gamut === "srgb" ? span : maxChroma(pixel.l, hue, "srgb");
    pixel.c = cs;
    const edge = channels(toRgb(pixel));
    for (let x = 0; x < w; x++) {
      pixel.c = columnShare(x, w) * span;
      const i = (y * w + x) * 4;
      put(i, pixel.c <= cs || p3 ? show(pixel) : edge);
    }
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * Paints lightness × chroma at one hue, the chroma axis fitted to the hue's P3 wedge. Inside sRGB
 * is the colour itself; between sRGB and P3 is the real P3 colour on a P3 canvas, else the row's
 * sRGB edge colour, which is the same chroma reduction mapToSrgb performs; past P3 is a faded veil.
 */
function paintAbsolute(
  canvas: HTMLCanvasElement,
  hue: number,
  wantP3: boolean,
) {
  const target = imageFor(canvas, wantP3);
  if (target === null) return;
  const { ctx, p3, w, h, image, show, put } = target;
  const span = axisMax(hue);
  const pixel = { mode: "oklch" as const, l: 0, c: 0, h: hue };
  for (let y = 0; y < h; y++) {
    const l = rowLightness(y, h);
    const cs = maxChroma(l, hue, "srgb");
    const cp = maxChroma(l, hue, "p3");
    pixel.l = l;
    pixel.c = cs;
    const edge = channels(toRgb(pixel));
    const veil = show({
      mode: "oklch",
      l: FADE_L0 + FADE_L1 * l,
      c: (p3 ? cp : cs) * FADE,
      h: hue,
    });
    for (let x = 0; x < w; x++) {
      pixel.c = columnShare(x, w) * span;
      const i = (y * w + x) * 4;
      if (pixel.c <= cs) put(i, show(pixel));
      else if (pixel.c <= cp) put(i, p3 ? show(pixel) : edge);
      else put(i, veil);
    }
  }
  ctx.putImageData(image, 0, 0);
}

interface EdgeLine {
  gamut: DisplayGamut;
  dashed: boolean;
  /** x and y as shares of the surface's width and height, top to bottom. */
  points: (readonly [number, number])[];
}

/**
 * The gamut edges a surface marks: sRGB's on a P3 oklch surface, sRGB's and P3's on the absolute
 * one. Sampled at the canvas's row centres so a line follows the painted boundary, and drawn over
 * the canvas rather than into it: the canvas is painted at half size and scaled up, and a line in
 * it is scaled up into a blur.
 */
function edgeLines(
  surface: ColorSurface,
  hue: number,
  gamut: DisplayGamut,
  rows: number,
): EdgeLine[] {
  if (surface === "hsv" || rows < 2) return [];
  const ys = [
    0,
    ...Array.from({ length: rows }, (_, y) => (y + 0.5) / rows),
    1,
  ];
  if (surface === "oklch") {
    if (gamut === "srgb") return [];
    const xs = ys.map((y) => {
      const span = maxChroma(1 - y, hue, "p3");
      return span > 0 ? maxChroma(1 - y, hue, "srgb") / span : 0;
    });
    // At L = 0 and 1 both edges are 0 and the share has no value; the ends take their neighbour's.
    xs[0] = xs[1];
    xs[xs.length - 1] = xs[xs.length - 2];
    return [
      {
        gamut: "srgb",
        dashed: false,
        points: ys.map((y, i) => [xs[i], y] as const),
      },
    ];
  }
  const span = axisMax(hue);
  const line = (edge: DisplayGamut, dashed: boolean): EdgeLine => ({
    gamut: edge,
    dashed,
    points: ys.map((y) => [maxChroma(1 - y, hue, edge) / span, y] as const),
  });
  return [line("p3", true), line("srgb", false)];
}

function channels(c: { r: number; g: number; b: number }) {
  return [c.r, c.g, c.b];
}

/** The oklch hue strip at the current lightness and chroma, mapped into sRGB per hue. */
function paintHue(canvas: HTMLCanvasElement, l: number, c: number) {
  const target = context2d(canvas, false);
  if (target === null) return;
  const { ctx } = target;
  const w = canvas.width;
  const image = ctx.createImageData(w, 1);
  // A grey's strip would be one flat grey; a floor on chroma keeps the hues tellable apart.
  const want = Math.max(c, 0.1);
  for (let x = 0; x < w; x++) {
    const hue = (x / (w - 1)) * 360;
    let lo = 0;
    let hi = want;
    if (!inUnit(toRgb({ mode: "oklch", l, c: hi, h: hue }))) {
      for (let k = 0; k < 12; k++) {
        const mid = (lo + hi) / 2;
        if (inUnit(toRgb({ mode: "oklch", l, c: mid, h: hue }))) lo = mid;
        else hi = mid;
      }
      hi = lo;
    }
    const rgb = toRgb({ mode: "oklch", l, c: hi, h: hue });
    image.data[x * 4] = byte(rgb.r);
    image.data[x * 4 + 1] = byte(rgb.g);
    image.data[x * 4 + 2] = byte(rgb.b);
    image.data[x * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

interface PickerState {
  color: Oklch;
  hold: HsvHold | null;
  /**
   * The C / maxChroma the oklch surface last set, so the thumb keeps its place where that maximum
   * is 0, at L = 0 and 1.
   */
  rel: number | null;
  /** The gamut `rel` was measured against; a hold from another gamut no longer applies. */
  relGamut: DisplayGamut | null;
  /** The output format when `format` does not pin one. */
  format: ColorFormat;
  /** What the text field shows while it differs from the formatted value. */
  draft: string | null;
  /** The last `value` prop this state accounts for. */
  seen: string;
  /** The last string handed to onValueChange. */
  emitted: string | null;
}

function stateFor(
  value: string,
  prev: PickerState | null,
  alpha: boolean,
): PickerState {
  const parsed = parseColor(value);
  if (parsed === null) {
    return {
      color: BLACK,
      hold: null,
      rel: null,
      relGamut: null,
      format: prev?.format ?? "oklch",
      draft: value,
      seen: value,
      emitted: null,
    };
  }
  const { color, format } = parsed;
  return {
    color: {
      ...color,
      h: color.c < ACHROMATIC && prev !== null ? prev.color.h : color.h,
      alpha: alpha ? color.alpha : 1,
    },
    hold: null,
    rel: null,
    relGamut: null,
    format: format ?? "oklch",
    draft: null,
    seen: value,
    emitted: null,
  };
}

function gradeOf(ratio: number): string {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA large";
  return "fails";
}

function isGrouped(
  swatches: readonly string[] | readonly SwatchGroup[],
): swatches is readonly SwatchGroup[] {
  return swatches.length > 0 && typeof swatches[0] !== "string";
}

interface EyeDropperLike {
  open(): Promise<{ sRGBHex: string }>;
}

function eyeDropperClass(): (new () => EyeDropperLike) | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as { EyeDropper?: new () => EyeDropperLike }).EyeDropper;
  return ctor ?? null;
}

/** A controlled colour input: area, hue and alpha sliders, text and channel fields, swatches. */
export function ColorPicker({
  value,
  onValueChange,
  onValueCommit,
  format,
  alpha = true,
  surfaces = ALL_SURFACES,
  surface,
  defaultSurface,
  onSurfaceChange,
  gamut = "srgb",
  resetValue,
  chromaLock,
  defaultChromaLock = false,
  onChromaLockChange,
  swatches,
  contrastWith,
  contrastLabel = "background",
  eyeDropper = true,
  disabled = false,
  className,
  extra,
}: ColorPickerProps) {
  const [st, setSt] = useState(() => stateFor(value, null, alpha));
  const [initial] = useState(() => parseColor(value)?.color ?? null);
  const [picked, setPicked] = useState<ColorSurface | undefined>(
    defaultSurface,
  );
  const [lockPicked, setLockPicked] = useState(defaultChromaLock);
  const latest = useRef(st);
  latest.current = st;
  const uncommitted = useRef(false);
  const id = useId();

  // A value that is not the panel's own last output replaces what it shows; an echo changes
  // nothing, so the full-precision state survives the round trip through a string.
  let state = st;
  if (value !== st.seen) {
    state =
      value === st.emitted
        ? { ...st, seen: value }
        : stateFor(value, st, alpha);
    latest.current = state;
    setSt(state);
  }

  const outFormat = format ?? state.format;
  const color = alpha ? state.color : { ...state.color, alpha: 1 };
  const formatted = formatColor(color, outFormat, { alpha });

  const offered = surfaces.length > 0 ? surfaces : ALL_SURFACES;
  const wanted = surface ?? picked ?? (outFormat === "oklch" ? "oklch" : "hsv");
  const shown = offered.includes(wanted) ? wanted : offered[0];
  const locked = chromaLock ?? lockPicked;

  const update = (next: PickerState, commit: boolean) => {
    const out = formatColor(next.color, format ?? next.format, { alpha });
    const changed = out !== latest.current.emitted;
    next = { ...next, emitted: out };
    latest.current = next;
    setSt(next);
    if (changed || commit) onValueChange?.(out);
    if (commit) {
      uncommitted.current = false;
      onValueCommit?.(out);
    } else if (changed) {
      uncommitted.current = true;
    }
  };

  const setColor = (
    next: Oklch,
    commit: boolean,
    extra?: Partial<PickerState>,
  ) => {
    update(
      {
        ...latest.current,
        hold: null,
        rel: null,
        draft: null,
        ...extra,
        relGamut: gamut,
        color: alpha ? next : { ...next, alpha: 1 },
      },
      commit,
    );
  };

  const commitPending = () => {
    if (uncommitted.current) update(latest.current, true);
  };

  const heldRel = (s: PickerState) => (s.relGamut === gamut ? s.rel : null);

  const pickSurface = (next: ColorSurface) => {
    setPicked(next);
    onSurfaceChange?.(next);
  };

  const toggleLock = () => {
    setLockPicked(!locked);
    onChromaLockChange?.(!locked);
  };

  // --- area ---
  const hsv = hsvOf(color, state.hold);
  const rel =
    shown === "oklch" ? (heldRel(state) ?? relativeOf(color, gamut)) : 0;
  const areaRaw =
    shown === "oklch"
      ? rel
      : shown === "absolute"
        ? color.c / axisMax(color.h)
        : clamp(hsv.s, 0, 1);
  const pinned = areaRaw > 1 + (shown === "oklch" ? PIN_SLACK : 0);
  const areaX = Math.min(1, areaRaw);
  const areaY = shown === "hsv" ? 1 - hsv.v : 1 - color.l;
  const gamutName = gamut === "p3" ? "P3" : "sRGB";

  const setFromArea = (x: number, y: number, commit: boolean) => {
    const cur = latest.current;
    const l = clamp(1 - y, 0, 1);
    if (shown === "oklch") {
      const r = clamp(x, 0, 1);
      setColor(
        { ...cur.color, l, c: r * maxChroma(l, cur.color.h, gamut) },
        commit,
        { rel: r },
      );
    } else if (shown === "absolute") {
      setColor(
        { ...cur.color, l, c: clamp(x, 0, 1) * axisMax(cur.color.h) },
        commit,
      );
    } else {
      const h = hsvOf(cur.color, cur.hold).h;
      const s = clamp(x, 0, 1);
      setColor(fromHsv(h, s, l, cur.color), commit, {
        hold: { h, s },
      });
    }
  };

  const dragging = useRef(false);
  const pointAt = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return [
      box.width > 0 ? (event.clientX - box.left) / box.width : 0,
      box.height > 0 ? (event.clientY - box.top) / box.height : 0,
    ] as const;
  };

  const onAreaKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    const delta = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const cur = latest.current;
    if (shown === "oklch") {
      const r = heldRel(cur) ?? relativeOf(cur.color, gamut);
      if (delta[0] !== 0) {
        // From beyond the edge, the first horizontal step starts at the edge.
        const x = clamp(Math.min(r, 1) + delta[0] * 0.01, 0, 1);
        const c = x * maxChroma(cur.color.l, cur.color.h, gamut);
        setColor({ ...cur.color, c }, true, { rel: x });
      } else {
        const l = clamp(cur.color.l + delta[1] * 0.01, 0, 1);
        if (r > 1 + PIN_SLACK) {
          // Beyond the edge, a vertical step keeps C rather than clipping it to the edge.
          setColor({ ...cur.color, l }, true);
        } else {
          const x = Math.min(r, 1);
          const c = x * maxChroma(l, cur.color.h, gamut);
          setColor({ ...cur.color, l, c }, true, { rel: x });
        }
      }
    } else if (shown === "absolute") {
      setColor(
        {
          ...cur.color,
          l: clamp(cur.color.l + delta[1] * 0.01, 0, 1),
          // A vertical step leaves chroma alone, even one typed past the area's axis.
          c:
            delta[0] === 0
              ? cur.color.c
              : clamp(
                  cur.color.c + delta[0] * 0.004,
                  0,
                  Math.max(axisMax(cur.color.h), cur.color.c),
                ),
        },
        true,
      );
    } else {
      const now = hsvOf(cur.color, cur.hold);
      const s = clamp(now.s + delta[0] / 100, 0, 1);
      const v = clamp(now.v + delta[1] / 100, 0, 1);
      setColor(fromHsv(now.h, s, v, cur.color), true, {
        hold: { h: now.h, s },
      });
    }
  };

  // --- canvases ---
  const areaRef = useRef<HTMLDivElement>(null);
  const areaCanvas = useRef<HTMLCanvasElement>(null);
  const hueCanvas = useRef<HTMLCanvasElement>(null);
  const [areaSize, setAreaSize] = useState({ w: 0, h: 0 });
  const [p3] = useState(supportsP3);

  useEffect(() => {
    const el = areaRef.current;
    if (el === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setAreaSize({ w: width, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The colour field is painted at half size: a smooth gradient survives the upscale, and the
  // per-pixel paint costs a quarter.
  const raster = {
    w: Math.round(areaSize.w / 2),
    h: Math.round(areaSize.h / 2),
  };
  const areaHue = color.h;
  useEffect(() => {
    if (shown === "hsv") return;
    const canvas = areaCanvas.current;
    if (canvas === null || raster.w < 2 || raster.h < 2) return;
    // Hue drags arrive faster than a raster can paint; one draw per frame is enough.
    const frame = requestAnimationFrame(() => {
      canvas.width = raster.w;
      canvas.height = raster.h;
      if (shown === "oklch") paintRelative(canvas, areaHue, gamut, p3);
      else paintAbsolute(canvas, areaHue, p3);
    });
    return () => cancelAnimationFrame(frame);
  }, [shown, areaHue, raster.w, raster.h, gamut, p3]);
  const edges = useMemo(
    () => edgeLines(shown, areaHue, gamut, raster.h),
    [shown, areaHue, gamut, raster.h],
  );

  const { l: lightness, c: chroma } = color;
  useEffect(() => {
    if (shown === "hsv") return;
    const canvas = hueCanvas.current;
    if (canvas === null) return;
    const frame = requestAnimationFrame(() => {
      canvas.width = 180;
      canvas.height = 1;
      paintHue(canvas, lightness, chroma);
    });
    return () => cancelAnimationFrame(frame);
  }, [shown, lightness, chroma]);

  // --- hue and alpha ---
  const hueValue = shown === "hsv" ? hsv.h : color.h;
  const setHue = (hue: number, commit: boolean) => {
    const cur = latest.current;
    if (shown !== "hsv") {
      // Not wrapped: 360 is the slider's right end, and wrapping it to 0 would throw the thumb
      // to the left end mid-drag. formatColor writes it as 0.
      const next = { ...cur.color, h: clamp(hue, 0, 360) };
      if (locked) {
        const kept = lockChroma(cur.color, next, gamut, heldRel(cur));
        setColor(kept.color, commit, { rel: kept.rel });
      } else {
        setColor(next, commit);
      }
    } else {
      const now = hsvOf(cur.color, cur.hold);
      const h = clamp(hue, 0, 360);
      setColor(fromHsv(h, now.s, now.v, cur.color), commit, {
        hold: { h, s: now.s },
      });
    }
  };
  const setChannel = (next: Oklch, key: string) => {
    const cur = latest.current;
    if (
      locked &&
      shown !== "hsv" &&
      outFormat === "oklch" &&
      (key === "l" || key === "h")
    ) {
      const kept = lockChroma(cur.color, next, gamut, heldRel(cur));
      setColor(kept.color, true, { draft: null, rel: kept.rel });
    } else {
      setColor(next, true, { draft: null });
    }
  };
  const setAlpha = (percent: number, commit: boolean) => {
    const cur = latest.current;
    update(
      { ...cur, color: { ...cur.color, alpha: clamp(percent / 100, 0, 1) } },
      commit,
    );
  };

  // --- text field ---
  const textInvalid = state.draft !== null && parseColor(state.draft) === null;
  const onText = (text: string) => {
    const parsed = parseColor(text);
    const cur = latest.current;
    if (parsed === null) {
      setSt({ ...cur, draft: text });
      latest.current = { ...cur, draft: text };
      return;
    }
    setColor(
      {
        ...parsed.color,
        h: parsed.color.c < ACHROMATIC ? cur.color.h : parsed.color.h,
      },
      false,
      { draft: text, format: parsed.format ?? cur.format },
    );
  };
  const endText = () => {
    const cur = latest.current;
    if (cur.draft !== null) {
      latest.current = { ...cur, draft: null };
      setSt(latest.current);
    }
  };

  // --- eyedropper ---
  const EyeDropper = eyeDropperClass();
  const showEyeDropper = eyeDropper && !disabled && EyeDropper !== null;
  const pickFromScreen = async () => {
    if (EyeDropper === null) return;
    let hex: string;
    try {
      hex = (await new EyeDropper().open()).sRGBHex;
    } catch {
      return; // cancelled
    }
    const parsed = parseColor(hex);
    if (parsed === null) return;
    const cur = latest.current;
    setColor(
      {
        ...parsed.color,
        h: parsed.color.c < ACHROMATIC ? cur.color.h : parsed.color.h,
        alpha: cur.color.alpha,
      },
      true,
      { draft: null },
    );
  };

  // --- chips ---
  const colorGamut = gamutOf(color);
  const contrastTarget =
    contrastWith === undefined ? null : parseColor(contrastWith);
  const ratio =
    contrastTarget === null ? null : contrastRatio(color, contrastTarget.color);

  // --- swatches ---
  const groups: { label: string; colors: readonly string[] }[] =
    swatches === undefined || swatches.length === 0
      ? []
      : isGrouped(swatches)
        ? [...swatches]
        : [{ label: "Swatches", colors: swatches }];
  // A grey takes the panel's hue when picked, so it is compared with it too.
  const isCurrent = (parsed: Oklch) =>
    formatColor(
      {
        ...parsed,
        h: parsed.c < ACHROMATIC ? color.h : parsed.h,
        alpha: alpha ? parsed.alpha : 1,
      },
      outFormat,
      { alpha },
    ) === formatted;
  const resetParsed = resetValue === undefined ? null : parseColor(resetValue);
  const reset =
    resetValue === undefined || resetParsed === null
      ? null
      : { color: resetParsed.color, format: resetParsed.format };
  // Reset adopts the reset value's format unless `format` pins one, so it is only done once the
  // output is in that format too.
  const atReset =
    reset !== null &&
    (format !== undefined ||
      reset.format === null ||
      reset.format === state.format) &&
    isCurrent(reset.color);
  const resetTo = () => {
    if (reset === null) return;
    const cur = latest.current;
    setColor(
      {
        ...reset.color,
        h: reset.color.c < ACHROMATIC ? cur.color.h : reset.color.h,
      },
      true,
      { draft: null, format: reset.format ?? cur.format },
    );
  };

  const pickSwatch = (text: string) => {
    const parsed = parseColor(text);
    if (parsed === null) return;
    const cur = latest.current;
    setColor(
      {
        ...parsed.color,
        h: parsed.color.c < ACHROMATIC ? cur.color.h : parsed.color.h,
      },
      true,
      { draft: null },
    );
  };

  return (
    <div
      data-slot="color-picker"
      className={cn("grid w-64 gap-2 text-xs", className)}
    >
      {offered.length > 1 && (
        <fieldset
          aria-label="Picking surface"
          className="grid gap-0.5 rounded-md bg-muted p-0.5"
          style={{
            gridTemplateColumns: `repeat(${offered.length}, minmax(0, 1fr))`,
          }}
        >
          {offered.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={shown === s}
              disabled={disabled}
              onClick={() => pickSurface(s)}
              className="h-6 rounded-[5px] text-[0.7rem] font-medium text-muted-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid disabled:opacity-50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs"
            >
              {SURFACE_LABELS[s]}
            </button>
          ))}
        </fieldset>
      )}

      <div
        ref={areaRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Colour"
        aria-roledescription="2D slider"
        aria-disabled={disabled || undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((1 - areaY) * 100)}
        aria-valuetext={
          shown === "hsv"
            ? `saturation ${round(hsv.s * 100, 1)}%, value ${round(hsv.v * 100, 1)}%`
            : shown === "absolute"
              ? `lightness ${round(color.l * 100, 1)}%, chroma ${round(color.c, 3)}`
              : pinned
                ? `lightness ${round(color.l * 100, 1)}%, chroma ${round(color.c, 3)}, beyond the ${gamutName} edge`
                : `lightness ${round(color.l * 100, 1)}%, chroma ${round(color.c, 3)} (${Math.round(rel * 100)}% of ${gamutName} max)`
        }
        className={cn(
          "relative h-42 cursor-crosshair touch-none overflow-hidden rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid",
          disabled && "pointer-events-none opacity-50",
        )}
        style={
          shown === "hsv"
            ? {
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`,
              }
            : undefined
        }
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) return;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          event.currentTarget.focus();
          dragging.current = true;
          const [x, y] = pointAt(event);
          setFromArea(x, y, false);
        }}
        onPointerMove={(event) => {
          if (!dragging.current) return;
          const [x, y] = pointAt(event);
          setFromArea(x, y, false);
        }}
        onPointerUp={() => {
          if (!dragging.current) return;
          dragging.current = false;
          update(latest.current, true);
        }}
        onPointerCancel={() => {
          if (!dragging.current) return;
          dragging.current = false;
          update(latest.current, true);
        }}
        onKeyDown={disabled ? undefined : onAreaKey}
      >
        {shown !== "hsv" && (
          <canvas ref={areaCanvas} className="block size-full" />
        )}
        {edges.length > 0 && (
          <svg
            aria-hidden
            data-gamut-edges
            width={areaSize.w}
            height={areaSize.h}
            className="pointer-events-none absolute inset-0"
          >
            {edges.map((edge) => (
              <polyline
                key={edge.gamut}
                data-edge={edge.gamut}
                points={edge.points
                  .map(
                    ([x, y]) =>
                      `${round(x * areaSize.w, 2)},${round(y * areaSize.h, 2)}`,
                  )
                  .join(" ")}
                fill="none"
                stroke="rgb(255 255 255 / 0.9)"
                strokeWidth={1}
                strokeLinejoin="round"
                strokeDasharray={edge.dashed ? "6 4" : undefined}
              />
            ))}
          </svg>
        )}
        <span
          aria-hidden
          data-thumb
          data-pinned={pinned || undefined}
          className="pointer-events-none absolute -mt-[7px] -ml-[7px] size-3.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.5),inset_0_0_0_1px_rgb(0_0_0/0.3)] data-pinned:outline-[1.5px] data-pinned:outline-offset-2 data-pinned:outline-destructive/70 data-pinned:outline-dashed"
          style={{ left: `${areaX * 100}%`, top: `${areaY * 100}%` }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 left-1 rounded-sm bg-black/45 px-1 text-[10px] text-white"
        >
          {shown === "hsv" ? "V ↑" : "L ↑"}
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute right-1 bottom-1 rounded-sm bg-black/45 px-1 text-[10px] text-white"
        >
          {shown === "oklch" ? "C/max →" : shown === "absolute" ? "C →" : "S →"}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <TrackSlider
          label="Hue"
          value={hueValue}
          max={360}
          disabled={disabled}
          onChange={(v) => setHue(v, false)}
          onCommit={(v) => setHue(v, true)}
          trackStyle={
            shown === "hsv"
              ? {
                  background:
                    "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
                }
              : undefined
          }
        >
          {shown !== "hsv" && (
            <canvas
              ref={hueCanvas}
              className="absolute inset-0 block size-full"
            />
          )}
        </TrackSlider>
        {shown !== "hsv" && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Keep relative chroma"
            aria-pressed={locked}
            title={
              locked
                ? `Hue and lightness keep the share of the ${gamutName} maximum chroma`
                : `Keep the share of the ${gamutName} maximum chroma when hue or lightness changes`
            }
            disabled={disabled}
            onClick={toggleLock}
          >
            {locked ? <LockIcon /> : <LockOpenIcon />}
          </Button>
        )}
      </div>

      {alpha && (
        <TrackSlider
          label="Alpha"
          value={color.alpha * 100}
          max={100}
          disabled={disabled}
          onChange={(v) => setAlpha(v, false)}
          onCommit={(v) => setAlpha(v, true)}
          trackStyle={CHECKERBOARD}
        >
          <span
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to right, ${css(color, 0)}, ${css(color, 1)})`,
            }}
          />
        </TrackSlider>
      )}

      <div className="flex items-center gap-1.5">
        <div
          role="img"
          aria-label="Before and after"
          title="Before / after"
          className="grid h-7 w-9 shrink-0 grid-cols-2 overflow-hidden rounded-md border"
          style={CHECKERBOARD}
        >
          <span
            style={{
              background:
                initial === null
                  ? "transparent"
                  : css(initial, alpha ? initial.alpha : 1),
            }}
          />
          <span style={{ background: css(color) }} />
        </div>
        <Input
          aria-label="Colour value"
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
          aria-invalid={textInvalid || undefined}
          value={state.draft ?? formatted}
          onChange={(event) => onText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              if (parseColor(latest.current.draft ?? formatted) === null)
                return;
              update({ ...latest.current, draft: null }, true);
            } else if (event.key === "Escape") {
              endText();
            }
          }}
          onBlur={() => {
            endText();
            commitPending();
          }}
          className="h-7 flex-1 px-1.5 font-mono text-base md:text-xs"
        />
        {showEyeDropper && (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Pick from screen"
            title="Pick from screen"
            onClick={pickFromScreen}
          >
            <PipetteIcon />
          </Button>
        )}
        {reset !== null && (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Reset"
            title={`Reset to ${resetValue}`}
            disabled={disabled || atReset}
            onClick={resetTo}
          >
            <RotateCcwIcon />
          </Button>
        )}
      </div>

      <ChannelFields
        color={color}
        format={outFormat}
        alpha={alpha}
        disabled={disabled}
        idPrefix={id}
        onSet={setChannel}
      />

      {/* A line of its own per chip, never wrapped, and the map button holding its place while
          hidden: a chip that wrapped or a button that came and went changed the panel's height
          mid-drag, and in a popover opened upwards that moved the surface from under the pointer. */}
      <div className="grid gap-1 text-[11px]">
        <div className="flex h-5 items-center gap-1.5">
          <span
            data-gamut={colorGamut}
            title={
              colorGamut !== "srgb" && outFormat !== "oklch"
                ? `Mapped to sRGB in ${outFormat}`
                : undefined
            }
            className={cn(
              "min-w-0 truncate rounded-full border px-1.5 py-px",
              colorGamut === "srgb"
                ? "border-success/60 text-success"
                : colorGamut === "p3"
                  ? "border-warning/70 text-warning"
                  : "border-destructive/70 text-destructive",
            )}
          >
            {colorGamut === "srgb"
              ? "in sRGB"
              : colorGamut === "p3"
                ? "outside sRGB · in P3"
                : "outside P3"}
          </span>
          <button
            type="button"
            disabled={disabled}
            title="Replace with the nearest colour inside sRGB"
            onClick={() =>
              setColor(mapToSrgb(latest.current.color), true, {
                draft: null,
              })
            }
            className="ml-auto shrink-0 underline underline-offset-2 disabled:opacity-50"
            // visibility rather than unmounting, for the space; inline rather than a class, so
            // jsdom sees it too and the button leaves the accessibility tree there as well.
            style={colorGamut === "srgb" ? { visibility: "hidden" } : undefined}
          >
            map to sRGB
          </button>
        </div>
        {ratio !== null && (
          <div className="flex h-5 items-center">
            <span
              data-contrast
              title={`WCAG 2 contrast against ${contrastWith}`}
              className={cn(
                "min-w-0 truncate rounded-full border px-1.5 py-px",
                ratio >= 4.5
                  ? "border-success/60 text-success"
                  : ratio >= 3
                    ? "border-warning/70 text-warning"
                    : "border-destructive/70 text-destructive",
              )}
            >
              {/* Truncated, so 4.4997 does not read 4.50 beside a grade that says it misses AA. */}
              {`${(Math.floor(ratio * 100 + 1e-6) / 100).toFixed(2)}:1 vs ${contrastLabel} · ${gradeOf(ratio)}`}
            </span>
          </div>
        )}
      </div>

      {groups.map((group) => {
        const usable = group.colors.flatMap((text) => {
          const parsed = parseColor(text);
          return parsed === null ? [] : [{ text, parsed }];
        });
        if (usable.length === 0) return null;
        return (
          <div key={group.label} className="grid gap-1">
            <div className="text-[10px] tracking-wide text-muted-foreground uppercase">
              {group.label}
            </div>
            <div className="grid grid-cols-10 gap-1">
              {usable.map(({ text, parsed }) => {
                const pressed = isCurrent(parsed.color);
                return (
                  <button
                    key={text}
                    type="button"
                    aria-label={text}
                    title={text}
                    aria-pressed={pressed}
                    disabled={disabled}
                    onClick={() => pickSwatch(text)}
                    className="aspect-square rounded-full border border-black/15 outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring focus-visible:outline-solid disabled:opacity-50 aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-2 aria-pressed:ring-offset-popover"
                    style={{
                      ...CHECKERBOARD,
                      backgroundImage: `linear-gradient(${css(parsed.color)}, ${css(parsed.color)}), ${CHECKERBOARD.backgroundImage}`,
                      backgroundSize: `auto, ${CHECKERBOARD.backgroundSize}`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {extra}
    </div>
  );
}

function TrackSlider({
  label,
  value,
  max,
  disabled,
  onChange,
  onCommit,
  trackStyle,
  children,
}: {
  label: string;
  value: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  trackStyle?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <SliderPrimitive.Root
      value={[value]}
      min={0}
      max={max}
      step={1}
      disabled={disabled}
      onValueChange={([v]) => onChange(v)}
      onValueCommit={([v]) => onCommit(v)}
      className="relative flex h-3 w-full touch-none items-center select-none data-disabled:opacity-50"
    >
      <SliderPrimitive.Track
        className="relative h-3 grow overflow-hidden rounded-full"
        style={trackStyle}
      >
        {children}
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        className="block size-3.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.5),inset_0_0_0_1px_rgb(0_0_0/0.3)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
      />
    </SliderPrimitive.Root>
  );
}

interface ChannelSpec {
  key: string;
  label: string;
  name: string;
  text: string;
  apply: (n: number) => Oklch;
}

function channelSpecs(
  color: Oklch,
  format: ColorFormat,
  alpha: boolean,
): ChannelSpec[] {
  const specs: ChannelSpec[] = [];
  if (format === "oklch") {
    specs.push(
      {
        key: "l",
        label: "L",
        name: "Lightness",
        text: round(color.l, 3),
        apply: (n) => ({ ...color, l: clamp(n, 0, 1) }),
      },
      {
        key: "c",
        label: "C",
        name: "Chroma",
        text: round(color.c, 3),
        apply: (n) => ({ ...color, c: Math.max(0, n) }),
      },
      {
        key: "h",
        label: "H",
        name: "Hue",
        text: round(color.h, 3),
        apply: (n) => ({ ...color, h: wrapHue(n) }),
      },
    );
  } else if (format === "hsl") {
    const srgb = srgbOf(color);
    const hsl = toHsl({ mode: "rgb", ...srgb });
    const grey = !(hsl.s > 1e-9) || !Number.isFinite(hsl.s);
    const h = grey || hsl.h === undefined ? 0 : hsl.h;
    const s = grey ? 0 : hsl.s;
    const set = (next: { h: number; s: number; l: number }) => {
      const rgb = toRgb({ mode: "hsl", ...next });
      return oklchOfRgb(
        {
          r: clamp(rgb.r, 0, 1),
          g: clamp(rgb.g, 0, 1),
          b: clamp(rgb.b, 0, 1),
        },
        color.h,
        color.alpha,
      );
    };
    specs.push(
      {
        key: "h",
        label: "H",
        name: "Hue",
        text: round(h, 1),
        apply: (n) => set({ h: wrapHue(n), s, l: hsl.l }),
      },
      {
        key: "s",
        label: "S%",
        name: "Saturation",
        text: round(s * 100, 1),
        apply: (n) => set({ h, s: clamp(n, 0, 100) / 100, l: hsl.l }),
      },
      {
        key: "l",
        label: "L%",
        name: "Lightness",
        text: round(hsl.l * 100, 1),
        apply: (n) => set({ h, s, l: clamp(n, 0, 100) / 100 }),
      },
    );
  } else {
    const srgb = srgbOf(color);
    const bytes = { r: byte(srgb.r), g: byte(srgb.g), b: byte(srgb.b) };
    for (const [key, name] of [
      ["r", "Red"],
      ["g", "Green"],
      ["b", "Blue"],
    ] as const) {
      specs.push({
        key,
        label: key.toUpperCase(),
        name,
        text: String(bytes[key]),
        apply: (n) => {
          const next = { ...bytes, [key]: Math.round(clamp(n, 0, 255)) };
          return oklchOfRgb(
            { r: next.r / 255, g: next.g / 255, b: next.b / 255 },
            color.h,
            color.alpha,
          );
        },
      });
    }
  }
  if (alpha) {
    specs.push({
      key: "a",
      label: "A%",
      name: "Alpha",
      text: round(color.alpha * 100, 1),
      apply: (n) => ({ ...color, alpha: clamp(n, 0, 100) / 100 }),
    });
  }
  return specs;
}

function ChannelFields({
  color,
  format,
  alpha,
  disabled,
  idPrefix,
  onSet,
}: {
  color: Oklch;
  format: ColorFormat;
  alpha: boolean;
  disabled: boolean;
  idPrefix: string;
  onSet: (color: Oklch, key: string) => void;
}) {
  const specs = channelSpecs(color, format, alpha);
  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${specs.length}, minmax(0, 1fr))` }}
    >
      {specs.map((spec) => (
        <ChannelField
          key={`${format}-${spec.key}`}
          id={`${idPrefix}-${spec.key}`}
          spec={spec}
          disabled={disabled}
          onSet={onSet}
        />
      ))}
    </div>
  );
}

function ChannelField({
  id,
  spec,
  disabled,
  onSet,
}: {
  id: string;
  spec: ChannelSpec;
  disabled: boolean;
  onSet: (color: Oklch, key: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const settle = () => {
    if (draft === null) return;
    setDraft(null);
    const n = Number.parseFloat(draft);
    if (!Number.isFinite(n) || draft.trim() === spec.text) return;
    onSet(spec.apply(n), spec.key);
  };
  return (
    <div className="grid gap-px text-center">
      <label htmlFor={id} className="text-[10px] text-muted-foreground">
        {spec.label}
      </label>
      <Input
        id={id}
        aria-label={spec.name}
        inputMode="decimal"
        spellCheck={false}
        autoComplete="off"
        disabled={disabled}
        value={draft ?? spec.text}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") settle();
          else if (event.key === "Escape") setDraft(null);
        }}
        onBlur={settle}
        className="h-6 px-1 text-center font-mono text-base md:text-[11px]"
      />
    </div>
  );
}

export interface ColorPickerPopoverProps extends ColorPickerProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Passed to PopoverContent. Defaults are PopoverContent's. */
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  /** Replaces the default trigger; rendered through PopoverTrigger asChild, so one element. */
  children?: ReactElement;
  /** On the trigger. Default "Pick colour". */
  "aria-label"?: string;
}

/** The panel in a popover, behind a trigger showing the value. */
export function ColorPickerPopover({
  open,
  defaultOpen,
  onOpenChange,
  align,
  side,
  children,
  "aria-label": ariaLabel = "Pick colour",
  ...picker
}: ColorPickerPopoverProps) {
  const parsed = parseColor(picker.value);
  return (
    <Popover open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild aria-label={ariaLabel} disabled={picker.disabled}>
        {children ?? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="pl-1 font-mono text-xs"
          >
            <span
              aria-hidden
              className="size-5 shrink-0 overflow-hidden rounded-sm border border-black/15"
              style={CHECKERBOARD}
            >
              <span
                className="block size-full"
                style={{
                  background:
                    parsed === null ? "transparent" : css(parsed.color),
                }}
              />
            </span>
            {picker.value}
          </Button>
        )}
      </PopoverTrigger>
      {/* The panel mounts on each open, so its before half is the value at that moment. */}
      <PopoverContent align={align} side={side} className="w-auto p-2">
        <ColorPicker {...picker} />
      </PopoverContent>
    </Popover>
  );
}
