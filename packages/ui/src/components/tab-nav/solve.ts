import { type FoldStep, foldSteps, sortSteps } from "../overflow/fold.ts";
import type { OverflowResult } from "../overflow/store.ts";

export interface TabNavPart {
  id: string;
  /** `fixed`: a child the TabNav does not know, counted at its width and never folded. */
  kind: "link" | "fixed";
  width: number;
  /** The link to the section the reader is in. */
  current?: boolean;
}

export type TabNavView = "bar" | "overflow";

export interface TabNavLayout extends OverflowResult {
  views: Record<string, TabNavView>;
  /** The ⋯ is shown. */
  more: boolean;
  /** The current link is in the menu. */
  currentFolded: boolean;
  /** The current link's name, for the ⋯'s name; `null` without one. */
  currentName: string | null;
  /** Every part laid out. */
  full: number;
  /**
   * The width before the current link folds: the fixed parts, the current
   * link and the ⋯; the fixed parts and the ⋯ without a current link. Never
   * more than `full`, which it is when nothing could fold.
   */
  least: number;
}

/**
 * Lays a TabNav out for its width: the links fold into the ⋯ from the end,
 * the current one last, until what is left and the ⋯ fit. Only the width
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
      sum += part.width;
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

  const steps: FoldStep<TabNavView>[] = links.map((link, index) => ({
    key: [link.current ? 1 : 0, links.length - index],
    ids: [link.id],
    view: "overflow",
  }));
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
