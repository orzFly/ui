import { describe, expect, it } from "vitest";
import {
  builtinThemes,
  resolvePalette,
  schemesOf,
  variantsOf,
} from "../src/index.ts";
import { contrast, type Rgb, rgbOf } from "./color.ts";

/**
 * WCAG 1.4.11's floor for the edge that identifies a component: an empty
 * field, an unchecked checkbox, a switch's off track.
 */
const NON_TEXT = 3;

/** The surfaces a field sits on: the page, a card, a dialog or popover. */
const SURFACES = ["background", "card", "popover"] as const;

const resolved = builtinThemes.flatMap((theme) =>
  schemesOf(theme).flatMap((scheme) =>
    variantsOf(theme).map(({ id }) => ({
      name: `${theme.id} ${scheme} ${id}`,
      // biome-ignore lint/style/noNonNullAssertion: schemesOf lists only present sides
      tokens: resolvePalette(theme, scheme, id)!.tokens,
    })),
  ),
);

/** `value` painted over `surface`; default dark's `input` is white at an alpha. */
function painted(value: string, surface: Rgb): Rgb {
  const m = /^(oklch\([^/]*?)\s*\/\s*([\d.]+)%\s*\)$/.exec(value);
  if (!m) return rgbOf(value);
  const alpha = Number(m[2]) / 100;
  const colour = rgbOf(`${m[1]})`);
  return colour.map((v, i) => v * alpha + surface[i] * (1 - alpha)) as Rgb;
}

describe("field edge contrast", () => {
  it("draws input at 3:1 or more on every surface a field sits on", () => {
    const rows = resolved.flatMap(({ name, tokens }) =>
      SURFACES.map((surface) => {
        const under = rgbOf(tokens[surface]);
        return {
          name: `${name} input/${surface}`,
          ratio: contrast(painted(tokens.input, under), under),
        };
      }),
    );
    expect(rows).toHaveLength(resolved.length * SURFACES.length);
    expect(
      rows
        .filter((r) => r.ratio < NON_TEXT)
        .map((r) => `${r.name} ${r.ratio.toFixed(2)}:1`),
    ).toEqual([]);
  });
});
