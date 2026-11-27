import { type FoldStep, foldSteps, sortSteps } from "../overflow/fold.ts";
import type { OverflowResult } from "../overflow/store.ts";

export interface TabNavPart {
  id: string;
  /** `fixed`: a child the TabNav does not know, counted at its width and never folded. */
  kind: "link" | "fixed";
  width: number;
  /** The link to the section the reader is in. */
  current?: boolean;
  /** Its width with its words cut short to two letters and an ellipsis; the current link's only. */
  narrowest?: number;
}

/** On the row; on the row with its words cut short (the current link alone); in the ⋯ menu. */
export type TabNavView = "bar" | "cut" | "overflow";

export interface TabNavLayout extends OverflowResult {
  views: Record<string, TabNavView>;
  /** The ⋯ is shown. */
  more: boolean;
  /** The current link is in the menu: not even cut short does it fit beside the ⋯. */
  currentFolded: boolean;
  /** The current link's name, for the ⋯'s name; `null` without one. */
  currentName: string | null;
  /** Every part laid out. */
  full: number;
  /**
   * The width before the current link gives up any room: the fixed parts,
   * the current link in full and the ⋯; the fixed parts and the ⋯ without a
   * current link. Never more than `full`, which it is when nothing could fold.
   */
  least: number;
}

/**
 * Lays a TabNav out for its width: the links fold into the ⋯ from the end,
 * passing over the current one, until what is left and the ⋯ fit. Then the
 * current link's words are cut short, down to two letters and an ellipsis,
 * and only when even that does not fit does it fold too. Only the width
 * decides, never the layout before.
 */
export function solveTabNav(input: {
  available: number;
  triggerWidth: number;
  parts: readonly TabNavPart[];
  gap?: number;
  currentName?: string | null;
}): TabNavLayout {
  const { parts, triggerWidth } = input;
  const gap = input.gap ?? 0;
  const links = parts.filter((part) => part.kind === "link");
  const views: Record<string, TabNavView> = {};
  for (const link of links) views[link.id] = "bar";

  const width = (current: Readonly<Record<string, TabNavView>>) => {
    let sum = 0;
    let count = 0;
    let folded = false;
    for (const part of parts) {
      if (part.kind === "link" && current[part.id] === "overflow") {
        folded = true;
        continue;
      }
      sum +=
        part.kind === "link" && current[part.id] === "cut"
          ? (part.narrowest ?? part.width)
          : part.width;
      count++;
    }
    if (folded) {
      sum += triggerWidth;
      count++;
    }
    return sum + gap * Math.max(count - 1, 0);
  };

  const full = width(views);
  const leastViews: Record<string, TabNavView> = {};
  for (const link of links) {
    leastViews[link.id] = link.current ? "bar" : "overflow";
  }
  const least = links.length === 0 ? full : Math.min(full, width(leastViews));

  const steps = links.flatMap((link, index): FoldStep<TabNavView>[] => {
    const fold: FoldStep<TabNavView> = {
      key: [link.current ? 2 : 0, links.length - index],
      ids: [link.id],
      view: "overflow",
    };
    if (
      !link.current ||
      link.narrowest === undefined ||
      link.narrowest >= link.width
    )
      return [fold];
    return [
      { key: [1, links.length - index], ids: [link.id], view: "cut" },
      fold,
    ];
  });
  const fitted =
    input.available <= 0
      ? views
      : foldSteps(
          views,
          sortSteps(steps),
          (current) => width(current) <= input.available,
        ).views;

  const overflow = links
    .filter((link) => fitted[link.id] === "overflow")
    .map((link) => link.id);
  return {
    views: fitted,
    overflow,
    breaks: [],
    more: overflow.length > 0,
    currentFolded: links.some(
      (link) => link.current && fitted[link.id] === "overflow",
    ),
    currentName: input.currentName ?? null,
    full,
    least,
  };
}
