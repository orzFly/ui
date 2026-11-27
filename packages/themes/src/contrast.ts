import { contrast, painted, rgbOf } from "./rgb.ts";
import { DEFAULT_STYLE } from "./styles.ts";
import { TAG_COLORS, tagFill } from "./tag.ts";
import type { ColorScheme, TokenName, Tokens } from "./types.ts";

/** A token, or a tag's own fill, worked out from the tag colour drawn on it. */
export type ContrastSurface = TokenName | "tag-fill";

/** A set of token pairs held to one WCAG floor. */
export interface ContrastCheck {
  id:
    | "primary"
    | "text"
    | "selection"
    | "field"
    | "focus"
    | "state"
    | "chart"
    | "marker"
    | "tag";
  /** The lowest ratio the pairs may have. */
  floor: number;
  /** Each pair as [drawn, what it is drawn on]. */
  pairs: readonly (readonly [TokenName, ContrastSurface])[];
  /**
   * The styles whose drawing makes these pairs: a palette is held to the
   * check when its theme belongs to one of them. Absent, every style draws
   * them.
   */
  styles?: readonly string[];
}

/** WCAG AA for normal-size text (SC 1.4.3). */
const TEXT = 4.5;
/** The edge that identifies a component, and a focus indicator (SC 1.4.11, 2.4.13). */
const NON_TEXT = 3;

/**
 * The pairs the built-in themes are held to. Secondary and status text sits on
 * the page, on muted (an inactive tab) and in popovers (a destructive menu
 * item); selected text on its fill; a field's edge on the surfaces a field
 * sits on; a focus ring, drawn 2px off the control, on what lies behind it,
 * never the control's own fill. Under the default style a file tree's row
 * keeps its status colour, or an ignored file's muted one, on the accent of a
 * hovered or current row, and on a sidebar and its accent.
 * The state cues are each style's own. The default style marks a highlighted
 * or selected row by a tick in its accent-foreground text on its accent fill,
 * in a menu, on the page or in a sidebar, and the current tab by a primary
 * edge on the page; raymond fills the item with primary, which must stand out from the surface and
 * carry its primary-foreground text. A chart's series sits on the page; the module marker's icon,
 * drawn in primary, on its square. The default style draws a tag's name in its colour on its own
 * fill, that colour mixed into the page; raymond draws the colour as a swatch beside the page's
 * text, which no pair here measures.
 */
export const CONTRAST_CHECKS: readonly ContrastCheck[] = [
  {
    id: "primary",
    floor: TEXT,
    pairs: [
      ["primary-foreground", "primary"],
      ["primary", "background"],
    ],
  },
  {
    id: "text",
    floor: TEXT,
    pairs: [
      ["muted-foreground", "background"],
      ["muted-foreground", "muted"],
      ...(["destructive", "success", "warning"] as const).flatMap(
        (status) =>
          [
            [status, "background"],
            [status, "popover"],
          ] as const,
      ),
    ],
  },
  {
    id: "text",
    floor: TEXT,
    styles: [DEFAULT_STYLE],
    pairs: (
      ["destructive", "success", "warning", "muted-foreground"] as const
    ).flatMap(
      (status) =>
        [
          [status, "accent"],
          [status, "sidebar"],
          [status, "sidebar-accent"],
        ] as const,
    ),
  },
  {
    id: "selection",
    floor: TEXT,
    pairs: [["selection-foreground", "selection"]],
  },
  {
    id: "text",
    floor: TEXT,
    styles: ["raymond"],
    pairs: [["sidebar-primary-foreground", "sidebar-primary"]],
  },
  {
    id: "field",
    floor: NON_TEXT,
    pairs: [
      ["input", "background"],
      ["input", "card"],
      ["input", "popover"],
    ],
  },
  {
    id: "focus",
    floor: NON_TEXT,
    pairs: [
      ["ring", "background"],
      ["ring", "card"],
      ["ring", "popover"],
      ["ring", "muted"],
      ["sidebar-ring", "sidebar"],
    ],
  },
  {
    id: "state",
    floor: NON_TEXT,
    styles: [DEFAULT_STYLE],
    pairs: [
      ["accent-foreground", "accent"],
      ["sidebar-accent-foreground", "sidebar-accent"],
      ["primary", "background"],
    ],
  },
  {
    id: "state",
    floor: NON_TEXT,
    styles: ["raymond"],
    pairs: [
      ["primary", "background"],
      ["primary", "popover"],
      ["sidebar-primary", "sidebar"],
    ],
  },
  {
    id: "chart",
    floor: NON_TEXT,
    pairs: (
      ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const
    ).map((chart) => [chart, "background"] as const),
  },
  {
    id: "marker",
    floor: TEXT,
    pairs: [["primary", "marker"]],
  },
  {
    id: "tag",
    floor: TEXT,
    styles: [DEFAULT_STYLE],
    pairs: TAG_COLORS.map((color) => [`tag-${color}`, "tag-fill"] as const),
  },
];

export interface ContrastRow {
  check: ContrastCheck["id"];
  floor: number;
  foreground: TokenName;
  surface: ContrastSurface;
  ratio: number;
}

/**
 * Every pair of `CONTRAST_CHECKS` that the palette's styles draw, measured in
 * its tokens; `styles` is its theme's (`stylesOf`). `scheme` picks the share
 * of a tag's colour in its fill.
 */
export function contrastRows(
  tokens: Tokens,
  styles: readonly string[],
  scheme: ColorScheme,
): ContrastRow[] {
  return CONTRAST_CHECKS.filter(
    (check) =>
      check.styles === undefined ||
      check.styles.some((style) => styles.includes(style)),
  ).flatMap(({ id, floor, pairs }) =>
    pairs.map(([foreground, surface]) => {
      const under = rgbOf(
        surface === "tag-fill"
          ? tagFill(tokens[foreground], tokens.background, scheme)
          : tokens[surface],
      );
      return {
        check: id,
        floor,
        foreground,
        surface,
        ratio: contrast(painted(tokens[foreground], under), under),
      };
    }),
  );
}
