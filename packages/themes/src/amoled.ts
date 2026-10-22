import type { TerminalTokens, TokenName, Tokens, Variant } from "./types.ts";

const PANELS: readonly TokenName[] = [
  "background",
  "card",
  "popover",
  "sidebar",
];

const LIFTED: readonly TokenName[] = [
  "secondary",
  "muted",
  "accent",
  "sidebar-accent",
  "border",
  "input",
  "sidebar-border",
];

/** `oklch(L C H)` with no alpha; anything else (hex, alpha, var()) is null. */
function parse(value: string): [number, string, string] | null {
  const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  return m ? [Number(m[1]), m[2], m[3]] : null;
}

/** WCAG relative luminance through CSS Color 4's Oklab matrices, not clamped to sRGB. */
function luminance(lightness: number, chroma: number, hue: number): number {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return (
    0.2126 *
      (4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short) +
    0.7152 *
      (-1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short) +
    0.0722 *
      (-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short)
  );
}

/** The lightness at which this chroma and hue reach `target` luminance. */
function lightnessFor(target: number, chroma: number, hue: number): number {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    if (luminance(mid, chroma, hue) < target) low = mid;
    else high = mid;
  }
  return high;
}

/**
 * The AMOLED variant for a dark palette. The panels (background, card,
 * popover, sidebar) drop by the background's lightness, so the background
 * lands on pure black and the rest stay near it. Highlights, fills and opaque
 * borders instead keep their WCAG contrast with the background: luminance
 * goes roughly as L³, so the same lightness step that reads on the dark
 * background all but vanishes at black. Hue and chroma are kept throughout. A
 * value it cannot parse is left out, so the palette's own shows through; one
 * carrying alpha already composites over whatever is beneath it.
 */
export function amoled(palette: {
  tokens: Tokens;
  terminal: TerminalTokens;
}): Variant {
  const tokens: Partial<Tokens> = {};
  const background = parse(palette.tokens.background);
  if (background !== null) {
    const [bl, bc, bh] = background;
    for (const name of PANELS) {
      const surface = parse(palette.tokens[name]);
      if (surface === null) continue;
      // Rounded so float error never prints 0.10000000000000003.
      const lightness = Math.round((surface[0] - bl) * 1e4) / 1e4;
      // Chroma means nothing at zero lightness; say black plainly.
      tokens[name] =
        lightness <= 0
          ? "oklch(0 0 0)"
          : `oklch(${lightness} ${surface[1]} ${surface[2]})`;
    }
    const base = luminance(bl, Number(bc), Number(bh)) + 0.05;
    for (const name of LIFTED) {
      const surface = parse(palette.tokens[name]);
      if (surface === null) continue;
      const [l, c, h] = surface;
      const ratio = (luminance(l, Number(c), Number(h)) + 0.05) / base;
      // Black's luminance is 0, so this ratio against it needs 0.05·(ratio − 1);
      // rounded up so the contrast never lands under it.
      const lightness =
        Math.ceil(
          lightnessFor(0.05 * (ratio - 1), Number(c), Number(h)) * 1e3,
        ) / 1e3;
      tokens[name] =
        ratio <= 1 ? "oklch(0 0 0)" : `oklch(${lightness} ${c} ${h})`;
    }
  }
  return {
    label: "AMOLED",
    tokens,
    terminal: { "terminal-background": "#000000" },
  };
}
