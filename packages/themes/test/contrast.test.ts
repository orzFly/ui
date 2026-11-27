import { describe, expect, it } from "vitest";
import { CONTRAST_CHECKS, contrastRows } from "../src/contrast.ts";
import { builtinThemes, DEFAULT_STYLE, resolvePalette } from "../src/index.ts";
import { contrast, distance, painted, rgbOf } from "../src/rgb.ts";
import { SELECTION_APART, SELECTION_SURFACES } from "../src/selection.ts";
import {
  blendOf,
  labOfValue,
  lchOf,
  onFill,
  TAG_COLORS,
  TAG_HUES,
  type TagColor,
} from "../src/tag.ts";
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
    const rows = resolved.flatMap(({ name, tokens, styles, scheme }) =>
      contrastRows(tokens, styles, scheme)
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

describe("selection fill", () => {
  it(`stands ${SELECTION_APART} off every surface selected text sits on`, () => {
    const rows = resolved.flatMap(({ name, tokens }) => {
      const ground = rgbOf(tokens.background);
      const fill = painted(tokens.selection, ground);
      return SELECTION_SURFACES.map((surface) => ({
        name: `${name} selection/${surface}`,
        ratio: distance(fill, painted(tokens[surface], ground)),
      }));
    });
    expect(failures("selection-apart", rows, SELECTION_APART)).toEqual([]);
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

type Chromatic = Exclude<TagColor, "gray">;
const CHROMATIC = TAG_COLORS.filter((c): c is Chromatic => c !== "gray");
const tag = (tokens: Record<string, string>, color: TagColor) =>
  labOfValue(tokens[`tag-${color}`]);

describe("tag colour blends", () => {
  // A colour value between two hue-adjacent named colours, leaning toward
  // gray, is drawn as a color-mix() of them; each such mix keeps 4.5:1 on its
  // own fill.
  it("hold 4.5:1 on their own fill between every two hue-adjacent colours", () => {
    const rows = resolved
      .filter(({ styles }) => styles.includes(DEFAULT_STYLE))
      .flatMap(({ name, tokens, scheme }) =>
        CHROMATIC.flatMap((from, i) => {
          const to = CHROMATIC[(i + 1) % CHROMATIC.length];
          return Array.from({ length: 11 }, (_, step) => step * 10).flatMap(
            (toShare) =>
              [0, 25, 50, 75, 100].map((grayShare) => {
                const ink = blendOf(
                  tag(tokens, from),
                  tag(tokens, to),
                  tag(tokens, "gray"),
                  toShare / 100,
                  grayShare / 100,
                );
                return {
                  name: `${name} ${from}→${to} ${toShare}% gray ${grayShare}%`,
                  ratio: onFill(ink, labOfValue(tokens.background), scheme),
                };
              }),
          );
        }),
      );
    expect(rows.length).toBeGreaterThan(10000);
    expect(failures("tag-blend", rows, 4.5)).toEqual([]);
  });
});

describe("tag colour hues", () => {
  const apart = (x: number, y: number) => {
    const turn = Math.abs(x - y) % 360;
    return Math.min(turn, 360 - turn);
  };

  it("keep each colour nearer its own base hue than any other's", () => {
    const wrong = resolved.flatMap(({ name, tokens }) =>
      CHROMATIC.flatMap((color) => {
        const hue = lchOf(tag(tokens, color))[2];
        const nearest = CHROMATIC.reduce((best, other) =>
          apart(hue, TAG_HUES[other]) < apart(hue, TAG_HUES[best])
            ? other
            : best,
        );
        return nearest === color
          ? []
          : [`${name} ${color} ${hue.toFixed(1)}° is nearer ${nearest}`];
      }),
    );
    expect(wrong).toEqual([]);
  });

  it("keep gray all but neutral", () => {
    const rows = resolved.map(({ name, tokens }) => ({
      name: `${name} gray`,
      chroma: lchOf(tag(tokens, "gray"))[1],
    }));
    expect(
      rows.filter((r) => r.chroma > 0.03).map((r) => `${r.name} ${r.chroma}`),
    ).toEqual([]);
  });

  it("keep every two colours 0.04 apart in OKLab", () => {
    const close = resolved.flatMap(({ name, tokens }) =>
      CHROMATIC.flatMap((x, i) =>
        CHROMATIC.slice(i + 1).flatMap((y) => {
          const [a, b] = [tag(tokens, x), tag(tokens, y)];
          const gap = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
          return gap < 0.04 ? [`${name} ${x}/${y} ${gap.toFixed(3)}`] : [];
        }),
      ),
    );
    expect(close).toEqual([]);
  });
});
