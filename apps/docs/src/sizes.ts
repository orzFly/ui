// The numbers the guideline pages quote for @orz/ui's components, read off the classes that draw
// them as a page renders, so a page cannot keep a size or a duration the component has dropped.
// The classes come from `buttonVariants` or, for every part no export hands over, from @orz/ui's
// source through `virtual:orz-ui-source`, which fails the build when it cannot find one. The
// readers here know the few utilities those classes use; a shape they do not know throws.

import source from "virtual:orz-ui-source";
import { buttonVariants } from "@orz/ui/components/button";

type ButtonSize = NonNullable<Parameters<typeof buttonVariants>[0]>["size"];

/**
 * Lengths from the stylesheets that no class carries: `hitArea` in px, `headerSettle` in ms,
 * `anchorFlash` and tw-animate-css's `animateDefault` in s.
 */
export const css = source.css;

export type Pointer = "fine" | "coarse";

export interface Options {
  /** Which set of sizes: a mouse's, or what `touch:` gives a coarse pointer. */
  pointer?: Pointer;
  /** The value a `data-[size=…]:` variant matches, as the component sets `data-size`. */
  size?: string;
}

/** The class strings of `@orz/ui`'s parts, by the part. */
export const classes = {
  ...source.classes,
  filterOption: `${source.classes.filterRow} ${source.classes.filterCell}`,
};

/** Tailwind's own text steps: font size and line height. */
const TEXT: Record<string, [size: number, line: number]> = {
  xs: [12, 16],
  sm: [14, 20],
  base: [16, 24],
  lg: [18, 28],
};

/** A spacing step in px: `8` is 32px, `[18px]` is 18px; null for `full`, `fit` and the like. */
function spacing(value: string): number | null {
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value) * 4;
  const px = /^\[(\d+)px\]$/.exec(value);
  return px ? Number(px[1]) : null;
}

/** `touch:data-[size=sm]:h-7` as its variants and its utility, split outside brackets. */
function split(token: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token[i];
    if (char === "[") depth++;
    else if (char === "]") depth--;
    else if (char === ":" && depth === 0) {
      parts.push(token.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(token.slice(start));
  return parts;
}

/**
 * The utilities that apply at this pointer and size, on a wide screen, unconditional ones
 * first: Tailwind writes a variant's rule after the plain one, so it wins.
 */
function applying(
  text: string,
  { pointer = "fine", size = "default" }: Options,
) {
  const plain: string[] = [];
  const varied: string[] = [];
  for (const token of text.split(/\s+/).filter(Boolean)) {
    const variants = split(token);
    const utility = variants.pop() ?? "";
    const applies = variants.every(
      (variant) =>
        (variant === "touch" && pointer === "coarse") ||
        variant === `data-[size=${size}]` ||
        variant === "md",
    );
    if (applies) (variants.length > 0 ? varied : plain).push(utility);
  }
  return [...plain, ...varied];
}

interface Box {
  height: number;
  width: number | null;
  /** The height of the target a tap lands on. */
  hit: number;
  font: number;
  gap: number | null;
}

function box(text: string, options: Options = {}): Box {
  let height: number | null = null;
  let width: number | null = null;
  let min = 0;
  let padding = 0;
  let border = 0;
  let hitArea = false;
  let gap: number | null = null;
  let type = TEXT.sm;
  for (const utility of applying(text, options)) {
    const [, name = "", value = ""] =
      /^(min-h|h|w|size|py|gap|text)-(.+)$/.exec(utility) ?? [];
    // `w-full`, `h-px` and the like size by their container, not by a step.
    const length = spacing(value);
    if (utility === "border") border = 1;
    else if (utility === "hit-area") hitArea = true;
    else if (name === "text") type = TEXT[value] ?? type;
    else if (length === null) continue;
    else if (name === "h") height = length;
    else if (name === "w") width = length;
    else if (name === "size") height = width = length;
    else if (name === "min-h") min = length;
    else if (name === "py") padding = length;
    else if (name === "gap") gap = length;
  }
  const [font, line] = type ?? [14, 20];
  const drawn = Math.max(height ?? line + 2 * padding + 2 * border, min);
  return {
    height: drawn,
    width,
    hit: hitArea ? Math.max(drawn, css.hitArea) : drawn,
    font,
    gap,
  };
}

/** Drawn height in px, for a mouse unless `pointer` says otherwise. */
export const px = (text: string, options?: Options) =>
  box(text, options).height;

/** Drawn width in px. */
export function width(text: string, options?: Options): number {
  const found = box(text, options).width;
  if (found === null) throw new Error(`no width in "${text}"`);
  return found;
}

/** Drawn height on a coarse pointer, or "unchanged" when `touch:` leaves it as it is. */
export function touch(text: string, options?: Options): number | "unchanged" {
  const coarse = px(text, { ...options, pointer: "coarse" });
  return coarse === px(text, options) ? "unchanged" : coarse;
}

/** The height a finger can land on, with the `hit-area` around a control drawn smaller. */
export const hit = (text: string, options?: Options) =>
  box(text, { ...options, pointer: "coarse" }).hit;

/** Font size in px. */
export const font = (text: string, options?: Options) =>
  box(text, options).font;

/** The `gap` in px. */
export function gap(text: string, options?: Options): number {
  const found = box(text, options).gap;
  if (found === null) throw new Error(`no gap in "${text}"`);
  return found;
}

function match(pattern: RegExp, text: string): number {
  const found = pattern.exec(text)?.[1];
  if (found === undefined) throw new Error(`no ${pattern} in "${text}"`);
  return Number(found);
}

/** The `duration-*` in ms, or tw-animate-css's own for an `animate-in` that sets none. */
export function ms(text: string): number {
  if (/(?:^|\s)duration-\d/.test(text)) {
    return match(/(?:^|\s)duration-(\d+)(?:\s|$)/, text);
  }
  if (/(?:^|:)animate-(?:in|out)(?:\s|$)/.test(text)) {
    return Math.round(css.animateDefault * 1000);
  }
  throw new Error(`no duration in "${text}"`);
}

/** The options for a coarse pointer's sizes. */
export const coarse: Options = { pointer: "coarse" };

/** `Button`'s classes at a size. */
export const button = (size?: ButtonSize) => buttonVariants({ size });

/** The one value a sentence gives for several things; throws when they part. */
export function same<T>(first: T, ...rest: T[]): T {
  const other = rest.find((value) => value !== first);
  if (other !== undefined) {
    throw new Error(`expected the same value, got ${first} and ${other}`);
  }
  return first;
}

/** The smallest and largest of several values, as `24–36`. */
export const range = (...values: number[]) =>
  `${Math.min(...values)}–${Math.max(...values)}`;

/** The width in px a `(min-width: …)` query starts at. */
export const minWidth = (query: string) => match(/min-width: (\d+)px/, query);
