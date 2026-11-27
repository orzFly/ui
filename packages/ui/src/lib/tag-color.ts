import { TAG_COLORS, type TagColor, tagBlend } from "@orz/themes";
import { parseColor } from "./color.ts";

// autoTagColor never picks gray: it stands for no colour at all.
const PICKED = TAG_COLORS.filter((color) => color !== "gray");

function isTagColor(color: string): color is TagColor {
  return (TAG_COLORS as readonly string[]).includes(color);
}

/**
 * A named tag colour chosen by `key`, the same for the same key everywhere;
 * never `gray`.
 */
export function autoTagColor(key: string): TagColor {
  // 32-bit FNV-1a over the UTF-16 code units. The hash and PICKED's order
  // are what every app's tags are coloured by: changing either recolours them.
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return PICKED[hash % PICKED.length];
}

/**
 * The CSS colour a tag of this colour is drawn in: `var(--tag-…)` for a name, a
 * `color-mix()` of the theme's tag colours for any other colour value, undefined when
 * there is no colour or the value does not parse.
 */
export function tagInk(
  color: TagColor | (string & {}) | undefined,
): string | undefined {
  if (color === undefined) return undefined;
  if (isTagColor(color)) return `var(--tag-${color})`;
  const parsed = parseColor(color);
  if (parsed === null) return undefined;
  const blend = tagBlend(parsed.color.h, parsed.color.c);
  if (blend === "gray") return "var(--tag-gray)";
  const { from, to, toShare, grayShare } = blend;
  const hue =
    toShare === 0
      ? `var(--tag-${from})`
      : toShare === 100
        ? `var(--tag-${to})`
        : `color-mix(in oklch, var(--tag-${from}), var(--tag-${to}) ${toShare}%)`;
  return grayShare === 0
    ? hue
    : `color-mix(in oklab, ${hue}, var(--tag-gray) ${grayShare}%)`;
}
