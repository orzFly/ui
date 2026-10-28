import { contrast, painted, rgbOf } from "./rgb.ts";
import type { TokenName, Tokens } from "./types.ts";

/** A set of token pairs held to one WCAG floor. */
export interface ContrastCheck {
  id: "primary" | "text" | "field" | "focus";
  /** The lowest ratio the pairs may have. */
  floor: number;
  /** Each pair as [drawn, what it is drawn on]. */
  pairs: readonly (readonly [TokenName, TokenName])[];
}

/** WCAG AA for normal-size text (SC 1.4.3). */
const TEXT = 4.5;
/** The edge that identifies a component, and a focus indicator (SC 1.4.11, 2.4.13). */
const NON_TEXT = 3;

/**
 * The pairs the built-in themes are held to. Secondary and status text sits on
 * the page, on muted (an inactive tab) and in popovers (a destructive menu
 * item); a field's edge on the surfaces a field sits on; a focus ring, drawn
 * 2px off the control, on what lies behind it, never the control's own fill.
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
];

export interface ContrastRow {
  check: ContrastCheck["id"];
  floor: number;
  foreground: TokenName;
  surface: TokenName;
  ratio: number;
}

/** Every pair of `CONTRAST_CHECKS` measured in one palette's tokens. */
export function contrastRows(tokens: Tokens): ContrastRow[] {
  return CONTRAST_CHECKS.flatMap(({ id, floor, pairs }) =>
    pairs.map(([foreground, surface]) => {
      const under = rgbOf(tokens[surface]);
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
