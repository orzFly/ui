import { describe, expect, it } from "vitest";
import {
  builtinThemes,
  resolvePalette,
  schemesOf,
  variantsOf,
} from "../src/index.ts";
import { contrast, rgbOf } from "./color.ts";

/** WCAG AA for normal-size text, which every button and badge label is. */
const AA = 4.5;

// Every palette under every variant the theme offers; a variant a side lacks
// resolves to that side's default, which is what the page shows.
const resolved = builtinThemes.flatMap((theme) =>
  schemesOf(theme).flatMap((scheme) =>
    variantsOf(theme).map(({ id }) => ({
      name: `${theme.id} ${scheme} ${id}`,
      // biome-ignore lint/style/noNonNullAssertion: schemesOf lists only present sides
      tokens: resolvePalette(theme, scheme, id)!.tokens,
    })),
  ),
);

describe("primary contrast", () => {
  it("clears AA for primary-foreground on primary, and primary text on the page", () => {
    const rows = resolved.flatMap(({ name, tokens }) => {
      const primary = rgbOf(tokens.primary);
      return [
        {
          name: `${name} button`,
          ratio: contrast(primary, rgbOf(tokens["primary-foreground"])),
        },
        {
          name: `${name} link`,
          ratio: contrast(primary, rgbOf(tokens.background)),
        },
      ];
    });
    expect(
      rows
        .filter((r) => r.ratio < AA)
        .map((r) => `${r.name} ${r.ratio.toFixed(2)}:1`),
    ).toEqual([]);
  });
});
