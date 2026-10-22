import type { TerminalTokens, TokenName, Tokens, Variant } from "./types.ts";

const SURFACES: readonly TokenName[] = [
  "background",
  "card",
  "popover",
  "secondary",
  "muted",
  "accent",
  "sidebar",
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

/**
 * The AMOLED variant for a dark palette: every surface drops by the
 * background's lightness, so the background lands on pure black while the
 * surfaces keep their step from it and their hue. A value it cannot parse is
 * left out, so the palette's own shows through; one carrying alpha already
 * composites over whatever is beneath it.
 */
export function amoled(palette: {
  tokens: Tokens;
  terminal: TerminalTokens;
}): Variant {
  const tokens: Partial<Tokens> = {};
  const background = parse(palette.tokens.background);
  if (background !== null) {
    for (const name of SURFACES) {
      const surface = parse(palette.tokens[name]);
      if (surface === null) continue;
      // Rounded so float error never prints 0.10000000000000003.
      const lightness = Math.round((surface[0] - background[0]) * 1e4) / 1e4;
      // Chroma means nothing at zero lightness; say black plainly.
      tokens[name] =
        lightness <= 0
          ? "oklch(0 0 0)"
          : `oklch(${lightness} ${surface[1]} ${surface[2]})`;
    }
  }
  return {
    label: "AMOLED",
    tokens,
    terminal: { "terminal-background": "#000000" },
  };
}
