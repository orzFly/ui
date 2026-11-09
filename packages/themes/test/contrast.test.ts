import { describe, expect, it } from "vitest";
import { CONTRAST_CHECKS, contrastRows } from "../src/contrast.ts";
import { builtinThemes, DEFAULT_STYLE, resolvePalette } from "../src/index.ts";
import { contrast, rgbOf } from "../src/rgb.ts";
import { failures, resolvedPalettes as resolved } from "./palettes.ts";

// A check id names one floor; each style may add its own pairs under it.
const floors = new Map(CONTRAST_CHECKS.map(({ id, floor }) => [id, floor]));

describe.each([...floors])("%s contrast", (id, floor) => {
  it(`clears ${floor}:1 for every pair of the check`, () => {
    expect(
      new Set(
        CONTRAST_CHECKS.filter((check) => check.id === id).map((c) => c.floor),
      ).size,
    ).toBe(1);
    const rows = resolved.flatMap(({ name, tokens, styles }) =>
      contrastRows(tokens, styles)
        .filter((row) => row.check === id)
        .map((row) => ({
          name: `${name} ${row.foreground}/${row.surface}`,
          ratio: row.ratio,
        })),
    );
    expect(failures(id, rows, floor)).toEqual([]);
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

// The state cue carries a selected row's contrast, but a sidebar's fill is
// how its current place is found at a glance, and a page's accent laid on a
// sidebar's tint all but vanished there. No WCAG floor covers a fill, so this
// one is the library's own.
const SIDEBAR_FILL = 1.2;

describe("sidebar state fill", () => {
  it(`stands ${SIDEBAR_FILL}:1 off the sidebar wherever the default style draws it`, () => {
    const rows = resolved
      .filter(({ styles }) => styles.includes(DEFAULT_STYLE))
      .map(({ name, tokens }) => ({
        name: `${name} sidebar-accent/sidebar`,
        ratio: contrast(rgbOf(tokens["sidebar-accent"]), rgbOf(tokens.sidebar)),
      }));
    expect(failures("sidebar-fill", rows, SIDEBAR_FILL)).toEqual([]);
  });
});
