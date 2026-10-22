import { converter } from "culori/fn";
import { PipetteIcon } from "lucide-react";
import { Slider as SliderPrimitive } from "radix-ui";
import type * as React from "react";
import type { ReactElement } from "react";
import { useEffect, useId, useRef, useState } from "react";
import {
  type ColorFormat,
  contrastRatio,
  formatColor,
  gamutOf,
  mapToSrgb,
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

export type ColorSurface = "oklch" | "hsv";

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
  /** Default ["oklch", "hsv"]; one entry hides the toggle. */
  surfaces?: readonly ColorSurface[];
  surface?: ColorSurface;
  defaultSurface?: ColorSurface;
  onSurfaceChange?: (surface: ColorSurface) => void;
  swatches?: readonly string[] | readonly SwatchGroup[];
  contrastWith?: string;
  /** Default "background". */
  contrastLabel?: string;
  /** Default true; the button still only appears where window.EyeDropper exists. */
  eyeDropper?: boolean;
  disabled?: boolean;
  className?: string;
}

const ALL_SURFACES: readonly ColorSurface[] = ["oklch", "hsv"];
/** The oklch area's chroma axis; past every display gamut at every lightness. */
const MAX_CHROMA = 0.37;
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

/**
 * Paints lightness × chroma at one hue, one pixel at a time. Inside sRGB is the colour itself;
 * between sRGB and P3 is the real P3 colour on a P3 canvas, else the row's sRGB edge colour, which
 * is the same chroma reduction mapToSrgb performs; past P3 is hatched. Lines mark the two edges.
 */
function paintArea(canvas: HTMLCanvasElement, hue: number, wantP3: boolean) {
  const target = context2d(canvas, wantP3);
  if (target === null) return;
  const { ctx, p3 } = target;
  const w = canvas.width;
  const h = canvas.height;
  if (w < 2 || h < 2) return;
  const image = ctx.createImageData(w, h, {
    colorSpace: p3 ? "display-p3" : "srgb",
  });
  const data = image.data;
  const srgbEdge = new Array<number>(h).fill(0);
  const p3Edge = new Array<number>(h).fill(0);
  const pixel = { mode: "oklch" as const, l: 0, c: 0, h: hue };
  for (let y = 0; y < h; y++) {
    pixel.l = 1 - y / (h - 1);
    let edge = [0, 0, 0];
    for (let x = 0; x < w; x++) {
      pixel.c = (x / (w - 1)) * MAX_CHROMA;
      const i = (y * w + x) * 4;
      const rgb = toRgb(pixel);
      let out: number[];
      if (inUnit(rgb)) {
        srgbEdge[y] = x;
        p3Edge[y] = x;
        edge = [rgb.r, rgb.g, rgb.b];
        out = p3 ? channels(toP3(pixel)) : edge;
      } else {
        const wide = toP3(pixel);
        if (!inUnit(wide)) {
          const shade = ((x + y) >> 2) & 1 ? 128 : 158;
          data[i] = shade;
          data[i + 1] = shade;
          data[i + 2] = shade;
          data[i + 3] = 255;
          continue;
        }
        p3Edge[y] = x;
        out = p3 ? channels(wide) : edge;
      }
      data[i] = byte(out[0]);
      data[i + 1] = byte(out[1]);
      data[i + 2] = byte(out[2]);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const line = (edge: number[], dash: number[]) => {
    ctx.save();
    ctx.setLineDash(dash);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    edge.forEach((x, y) => {
      if (y === 0) ctx.moveTo(x + 0.5, y);
      else ctx.lineTo(x + 0.5, y);
    });
    ctx.stroke();
    ctx.restore();
  };
  line(p3Edge, [3, 2]);
  line(srgbEdge, []);
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
  swatches,
  contrastWith,
  contrastLabel = "background",
  eyeDropper = true,
  disabled = false,
  className,
}: ColorPickerProps) {
  const [st, setSt] = useState(() => stateFor(value, null, alpha));
  const [initial] = useState(() => parseColor(value)?.color ?? null);
  const [picked, setPicked] = useState<ColorSurface | undefined>(
    defaultSurface,
  );
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
        draft: null,
        ...extra,
        color: alpha ? next : { ...next, alpha: 1 },
      },
      commit,
    );
  };

  const commitPending = () => {
    if (uncommitted.current) update(latest.current, true);
  };

  const pickSurface = (next: ColorSurface) => {
    setPicked(next);
    onSurfaceChange?.(next);
  };

  // --- area ---
  const hsv = hsvOf(color, state.hold);
  const areaX =
    shown === "oklch" ? Math.min(1, color.c / MAX_CHROMA) : clamp(hsv.s, 0, 1);
  const areaY = shown === "oklch" ? 1 - color.l : 1 - hsv.v;

  const setFromArea = (x: number, y: number, commit: boolean) => {
    const cur = latest.current;
    if (shown === "oklch") {
      setColor(
        { ...cur.color, l: clamp(1 - y, 0, 1), c: clamp(x, 0, 1) * MAX_CHROMA },
        commit,
      );
    } else {
      const h = hsvOf(cur.color, cur.hold).h;
      const s = clamp(x, 0, 1);
      setColor(fromHsv(h, s, clamp(1 - y, 0, 1), cur.color), commit, {
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
                  Math.max(MAX_CHROMA, cur.color.c),
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
      setAreaSize({ w: Math.round(width / 2), h: Math.round(height / 2) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const areaHue = color.h;
  useEffect(() => {
    if (shown !== "oklch") return;
    const canvas = areaCanvas.current;
    if (canvas === null || areaSize.w < 2 || areaSize.h < 2) return;
    // Hue drags arrive faster than a raster can paint; one draw per frame is enough.
    const frame = requestAnimationFrame(() => {
      canvas.width = areaSize.w;
      canvas.height = areaSize.h;
      paintArea(canvas, areaHue, p3);
    });
    return () => cancelAnimationFrame(frame);
  }, [shown, areaHue, areaSize, p3]);

  const { l: lightness, c: chroma } = color;
  useEffect(() => {
    if (shown !== "oklch") return;
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
  const hueValue = shown === "oklch" ? color.h : hsv.h;
  const setHue = (hue: number, commit: boolean) => {
    const cur = latest.current;
    if (shown === "oklch") {
      // Not wrapped: 360 is the slider's right end, and wrapping it to 0 would throw the thumb
      // to the left end mid-drag. formatColor writes it as 0.
      setColor({ ...cur.color, h: clamp(hue, 0, 360) }, commit);
    } else {
      const now = hsvOf(cur.color, cur.hold);
      const h = clamp(hue, 0, 360);
      setColor(fromHsv(h, now.s, now.v, cur.color), commit, {
        hold: { h, s: now.s },
      });
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
  const gamut = gamutOf(color);
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
          className="grid grid-cols-2 gap-0.5 rounded-md bg-muted p-0.5"
        >
          {offered.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={shown === s}
              disabled={disabled}
              onClick={() => pickSurface(s)}
              className="h-6 rounded-[5px] text-[0.7rem] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs"
            >
              {s === "oklch" ? "OKLCH" : "HSV"}
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
          shown === "oklch"
            ? `lightness ${round(color.l * 100, 1)}%, chroma ${round(color.c, 3)}`
            : `saturation ${round(hsv.s * 100, 1)}%, value ${round(hsv.v * 100, 1)}%`
        }
        className={cn(
          "relative h-42 cursor-crosshair touch-none overflow-hidden rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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
        {shown === "oklch" && (
          <canvas ref={areaCanvas} className="block size-full" />
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute -mt-[7px] -ml-[7px] size-3.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.5),inset_0_0_0_1px_rgb(0_0_0/0.3)]"
          style={{ left: `${areaX * 100}%`, top: `${areaY * 100}%` }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 left-1.5 text-[10px] text-white/85 [text-shadow:0_0_2px_black]"
        >
          {shown === "oklch" ? "L ↑" : "V ↑"}
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute right-1.5 bottom-0.5 text-[10px] text-white/85 [text-shadow:0_0_2px_black]"
        >
          {shown === "oklch" ? "C →" : "S →"}
        </span>
      </div>

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
        {shown === "oklch" && (
          <canvas
            ref={hueCanvas}
            className="absolute inset-0 block size-full"
          />
        )}
      </TrackSlider>

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
      </div>

      <ChannelFields
        color={color}
        format={outFormat}
        alpha={alpha}
        disabled={disabled}
        idPrefix={id}
        onSet={(next) => setColor(next, true, { draft: null })}
      />

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span
          data-gamut={gamut}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-1.5 py-px whitespace-nowrap",
            gamut === "srgb"
              ? "border-emerald-500/60 text-emerald-700 dark:text-emerald-300"
              : gamut === "p3"
                ? "border-amber-500/70 text-amber-700 dark:text-amber-300"
                : "border-destructive/70 text-destructive",
          )}
        >
          {gamut === "srgb"
            ? "in sRGB"
            : gamut === "p3"
              ? "outside sRGB · in P3"
              : "outside P3"}
          {gamut !== "srgb" && outFormat !== "oklch" && (
            <span>· mapped to sRGB in {outFormat}</span>
          )}
          {gamut !== "srgb" && (
            <button
              type="button"
              disabled={disabled}
              title="Replace with the nearest colour inside sRGB"
              onClick={() =>
                setColor(mapToSrgb(latest.current.color), true, {
                  draft: null,
                })
              }
              className="underline underline-offset-2 disabled:opacity-50"
            >
              map to sRGB
            </button>
          )}
        </span>
        {ratio !== null && (
          <span
            data-contrast
            title={`WCAG 2 contrast against ${contrastWith}`}
            className={cn(
              "rounded-full border px-1.5 py-px whitespace-nowrap",
              ratio >= 4.5
                ? "border-emerald-500/60 text-emerald-700 dark:text-emerald-300"
                : ratio >= 3
                  ? "border-amber-500/70 text-amber-700 dark:text-amber-300"
                  : "border-destructive/70 text-destructive",
            )}
          >
            {/* Truncated, so 4.4997 does not read 4.50 beside a grade that says it misses AA. */}
            {`${(Math.floor(ratio * 100 + 1e-6) / 100).toFixed(2)}:1 vs ${contrastLabel} · ${gradeOf(ratio)}`}
          </span>
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
                // A grey swatch takes the panel's hue when picked, so it is compared with it too.
                const swatch = {
                  ...parsed.color,
                  h: parsed.color.c < ACHROMATIC ? color.h : parsed.color.h,
                  alpha: alpha ? parsed.color.alpha : 1,
                };
                const pressed =
                  formatColor(swatch, outFormat, { alpha }) === formatted;
                return (
                  <button
                    key={text}
                    type="button"
                    aria-label={text}
                    title={text}
                    aria-pressed={pressed}
                    disabled={disabled}
                    onClick={() => pickSwatch(text)}
                    className="aspect-square rounded-full border border-black/15 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-2 aria-pressed:ring-offset-popover"
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
        className="block size-3.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.5),inset_0_0_0_1px_rgb(0_0_0/0.3)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
  onSet: (color: Oklch) => void;
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
  onSet: (color: Oklch) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const settle = () => {
    if (draft === null) return;
    setDraft(null);
    const n = Number.parseFloat(draft);
    if (!Number.isFinite(n) || draft.trim() === spec.text) return;
    onSet(spec.apply(n));
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
