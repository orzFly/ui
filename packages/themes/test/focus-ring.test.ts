import { describe, expect, it } from "vitest";
import {
  builtinThemes,
  resolvePalette,
  schemesOf,
  variantsOf,
} from "../src/index.ts";
import { contrast, rgbOf } from "./color.ts";

/** WCAG 2.2 SC 1.4.11 and 2.4.13: a focus indicator against what it sits on. */
const FOCUS = 3;

const resolved = builtinThemes.flatMap((theme) =>
  schemesOf(theme).flatMap((scheme) =>
    variantsOf(theme).map(({ id }) => ({
      name: `${theme.id} ${scheme} ${id}`,
      // biome-ignore lint/style/noNonNullAssertion: schemesOf lists only present sides
      tokens: resolvePalette(theme, scheme, id)!.tokens,
    })),
  ),
);

// The outline is drawn 2px off the control, so what lies behind it is the
// surface the control sits on, never the control's own fill: the page, a card,
// a menu, a tab list. The destructive, success and warning outlines are held
// at 4.5:1 on the page and in popovers by contrast.test.ts.
const SURFACES = [
  ["ring", "background"],
  ["ring", "card"],
  ["ring", "popover"],
  ["ring", "muted"],
  ["sidebar-ring", "sidebar"],
] as const;

describe("focus ring contrast", () => {
  it("clears 3:1 against every surface a focused control sits on", () => {
    const rows = resolved.flatMap(({ name, tokens }) =>
      SURFACES.map(([ring, surface]) => ({
        name: `${name} ${ring}/${surface}`,
        ratio: contrast(rgbOf(tokens[ring]), rgbOf(tokens[surface])),
      })),
    );
    expect(
      rows
        .filter((r) => r.ratio < FOCUS)
        .map((r) => `${r.name} ${r.ratio.toFixed(2)}:1`),
    ).toEqual([]);
  });
});
