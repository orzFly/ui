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

// Secondary and error text on the surfaces it is drawn on: inactive tabs sit on
// muted, an error line on the page, a destructive menu item in a popover.
const TEXT = [
  ["muted-foreground", "background"],
  ["muted-foreground", "muted"],
  ["destructive", "background"],
  ["destructive", "popover"],
] as const;

describe("text contrast", () => {
  it("clears AA for muted and destructive text on the surfaces it sits on", () => {
    const rows = resolved.flatMap(({ name, tokens }) =>
      TEXT.map(([text, surface]) => ({
        name: `${name} ${text}/${surface}`,
        ratio: contrast(rgbOf(tokens[text]), rgbOf(tokens[surface])),
      })),
    );
    expect(
      rows
        .filter((r) => r.ratio < AA)
        .map((r) => `${r.name} ${r.ratio.toFixed(2)}:1`),
    ).toEqual([]);
  });
});

// A highlight, fill or border on the surface it usually sits on; the first
// is a menu row under the pointer.
const STATES = [
  ["accent", "popover"],
  ["accent", "background"],
  ["muted", "background"],
  ["secondary", "background"],
  ["sidebar-accent", "sidebar"],
  ["border", "popover"],
] as const;

describe("AMOLED state contrast", () => {
  it("shows every highlight, fill and opaque border at least as clearly as the dark palette", () => {
    const rows = builtinThemes.flatMap((theme) => {
      const dark = resolvePalette(theme, "dark")?.tokens;
      const black = resolvePalette(theme, "dark", "amoled")?.tokens;
      if (!dark || !black) return [];
      return STATES.flatMap(([state, surface]) => {
        // An alpha value composites over the surface, which rgbOf cannot do.
        if (dark[state].includes("/")) return [];
        return [
          {
            name: `${theme.id} ${state}/${surface}`,
            before: contrast(rgbOf(dark[state]), rgbOf(dark[surface])),
            after: contrast(rgbOf(black[state]), rgbOf(black[surface])),
          },
        ];
      });
    });
    expect(rows.length).toBeGreaterThan(60);
    expect(
      rows
        .filter((r) => r.after < r.before - 0.01)
        .map((r) => `${r.name} ${r.before.toFixed(2)} → ${r.after.toFixed(2)}`),
    ).toEqual([]);
  });
});
