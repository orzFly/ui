import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  builtinThemes,
  resolvePalette,
  schemesOf,
  variantsOf,
} from "@orz/themes";
import { describe, expect, it } from "vitest";

const BUTTON = readFileSync(
  join(import.meta.dirname, "../src/components/button.tsx"),
  "utf8",
);

/** WCAG AA for normal-size text, which every button and badge label is. */
const AA = 4.5;

type Rgb = [number, number, number];
type Lab = [number, number, number];

// Every palette under every variant its theme offers; a variant a side lacks
// resolves to that side's default, which is what the page shows then.
const PALETTES = builtinThemes.flatMap((theme) =>
  schemesOf(theme).flatMap((scheme) =>
    variantsOf(theme).map(({ id }) => ({
      name: `${theme.id} ${scheme} ${id}`,
      scheme,
      // biome-ignore lint/style/noNonNullAssertion: schemesOf lists only present sides
      tokens: resolvePalette(theme, scheme, id)!.tokens,
    })),
  ),
);

function oklab(spec: string): Lab {
  const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(spec);
  if (!m) throw new Error(`not a plain oklch() colour: ${spec}`);
  const hue = (Number(m[3]) * Math.PI) / 180;
  return [
    Number(m[1]),
    Number(m[2]) * Math.cos(hue),
    Number(m[2]) * Math.sin(hue),
  ];
}

/** CSS Color 4's Oklab matrices, then the sRGB transfer function. */
function srgb([lightness, a, b]: Lab): Rgb {
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const encode = (v: number) => {
    const e = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(e * 255)));
  };
  return [
    encode(4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short),
    encode(-1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short),
    encode(-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short),
  ];
}

/** `color-mix(in oklab, x, y t)`. */
const mix = (x: Lab, y: Lab, t: number): Lab =>
  x.map((v, i) => v * (1 - t) + y[i] * t) as Lab;

/** A `/NN` tint, which the browser composites in sRGB. */
const over = (fg: Rgb, bg: Rgb, alpha: number): Rgb =>
  fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as Rgb;

/** WCAG 2.x relative luminance and the (L1+0.05)/(L2+0.05) ratio. */
function contrast(x: Rgb, y: Rgb): number {
  const luminance = (c: Rgb) => {
    const [r, g, b] = c.map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(x);
  const b = luminance(y);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Read off the variant rather than transcribed, so retuning the class without
// re-measuring fails here instead of passing on a stale number.
const MIX =
  /text-\[color-mix\(in_oklab,var\(--destructive\),var\(--foreground\)_(\d+)%\)\]/.exec(
    BUTTON,
  );

describe("destructive variant contrast", () => {
  it("mixes --foreground into the label rather than using bare --destructive", () => {
    expect(MIX).not.toBeNull();
  });

  it("clears AA in every palette and variant, on its resting and hover tints", () => {
    const share = Number(MIX?.[1]) / 100;
    const rows = PALETTES.flatMap(({ name, scheme, tokens }) => {
      const destructive = oklab(tokens.destructive);
      const label = srgb(mix(destructive, oklab(tokens.foreground), share));
      const page = srgb(oklab(tokens.background));
      // bg-destructive/10 + hover /20; dark: /20 + hover /30.
      const tints = scheme === "dark" ? [0.2, 0.3] : [0.1, 0.2];
      return tints.map((alpha) => ({
        name: `${name}@${alpha}`,
        ratio: contrast(label, over(srgb(destructive), page, alpha)),
      }));
    });
    expect(
      rows
        .filter((r) => r.ratio < AA)
        .map((r) => `${r.name} ${r.ratio.toFixed(2)}:1`),
    ).toEqual([]);
  });
});
