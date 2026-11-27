import { type FoldStep, foldSteps, sortSteps } from "../overflow/fold.ts";

/**
 * How soon a part of a toolbar gives up its room: a number, lower first, or
 * `"pin"`, which stays on the bar until nothing else is left to move.
 */
export type ToolbarPriority = number | "pin";

/**
 * How a part stands on the bar: in full, with its labels hidden, as a
 * dropdown (a segmented control), as an icon (an empty search), in the ⋯
 * menu, or not drawn (a separator with nothing to part).
 */
export type UnitView =
  | "bar"
  | "label"
  | "dropdown"
  | "icon"
  | "overflow"
  | "hidden";

export interface SolverUnit {
  id: string;
  /**
   * `unit` is a registered part; `fixed` a child the toolbar does not know,
   * counted at its width and never moved; `overflow` the place a
   * `ToolbarOverflow` puts the ⋯.
   */
  kind: "unit" | "fixed" | "separator" | "spacer" | "overflow";
  /** Undisplayed by the caller's CSS: no width, no gap, never moved. */
  cssHidden?: boolean;
  /** Its width in full; a flexible part's least width. */
  width: number;
  /** Its width with its labels hidden, when it has labels that may hide. */
  labelWidth?: number;
  /** A segmented control's width as a dropdown. */
  dropdownWidth?: number;
  /** A search's width as its icon, when it may collapse to one. */
  iconWidth?: number;
  priority?: ToolbarPriority;
  /** Set away from its default: it leaves the bar last within its priority. */
  active?: boolean;
  /** It has a form in the ⋯ menu. */
  overflowable?: boolean;
  /** Parted from its neighbours in the ⋯ menu. */
  group?: boolean;
  /**
   * A search kept open: it never collapses to its icon, and when everything
   * else has gone to the ⋯ menu and it still does not fit, it takes the bar.
   */
  pinned?: boolean;
  /** Open, it keeps this view: it takes no folding step, and others fold around it. */
  held?: UnitView;
}

export interface SolverInput {
  /** The row's content width; at or below 0 nothing is laid out yet. */
  availableWidth: number;
  gap: number;
  /** The ⋯ button's width, margins included. */
  overflowTriggerWidth: number;
  /** The ⋯ with a one-digit count; `overflowTriggerWidth` by default. */
  overflowTriggerCountWidth?: number;
  /** The ⋯ with the widest count (`9+`); `overflowTriggerWidth` by default. */
  overflowTriggerWideCountWidth?: number;
  /** A `ToolbarOverflow` with items of its own shows the ⋯ whether or not anything overflows. */
  permanentOverflow?: boolean;
  /** A coarse pointer skips hiding labels: an icon alone has no tooltip under a finger. */
  coarsePointer: boolean;
  /** In order along the bar. */
  units: readonly SolverUnit[];
}

export type TriggerPlace =
  | { at: "explicit" }
  | { at: "end" }
  | { at: "before"; id: string };

export interface SolverResult {
  views: Record<string, UnitView>;
  /** The overflowed units, in order along the bar. */
  overflow: string[];
  /** Overflowed units the ⋯ menu parts from the one before with a separator. */
  breaks: string[];
  /** Where the ⋯ stands, or `null` while it is not shown. */
  trigger: TriggerPlace | null;
  /** How many overflowed units are set away from their defaults. */
  activeCount: number;
  /** A pinned search that does not fit beside anything takes the whole bar. */
  takeover: boolean;
  /** Pinned parts that do not fit even alone: the bar scrolls rather than clip them. */
  scrollable: boolean;
}

const rank = (priority: ToolbarPriority | undefined) =>
  priority === "pin" ? Number.POSITIVE_INFINITY : (priority ?? 0);

function widthIn(unit: SolverUnit, view: UnitView): number {
  switch (view) {
    case "label":
      return unit.labelWidth ?? unit.width;
    case "dropdown":
      return unit.dropdownWidth ?? unit.width;
    case "icon":
      return unit.iconWidth ?? unit.width;
    default:
      return unit.width;
  }
}

/**
 * Lays a toolbar out for its width by a fixed table of steps: each step
 * shrinks or moves one part (or, for labels, every part of one priority),
 * and the first run of steps after which the bar fits is the answer. The
 * table depends only on the parts, never on the width, so a wider bar takes
 * back the steps in reverse and the layout never flips between two answers.
 *
 * The steps, in order: hiding labels by priority (a fine pointer only), a
 * segmented control becoming a dropdown, an empty search becoming its icon,
 * then each part going to the ⋯ menu, lowest priority first, then those
 * set away from their defaults, then the cluster before the last spacer
 * before the one after it, from each cluster's end. Pinned parts that have a
 * form in the menu go last of all. A held part (one whose surface is open)
 * stays in the view it has and takes no step.
 *
 * The ⋯ widens to count the parts in it set away from their defaults, so its
 * width at a step follows the parts that step has moved into it; the table
 * of steps does not change.
 */
export function solveToolbar(input: SolverInput): SolverResult {
  const units = input.units.filter((unit) => !unit.cssHidden);
  const views: Record<string, UnitView> = {};
  for (const unit of input.units) views[unit.id] = unit.held ?? "bar";
  const explicit = units.find((unit) => unit.kind === "overflow");
  const permanent = explicit !== undefined && input.permanentOverflow === true;

  const lastSpacer = units.findLastIndex((unit) => unit.kind === "spacer");
  const clusterOf = (index: number) =>
    lastSpacer >= 0 && index > lastSpacer ? 1 : 0;
  // Position from its cluster's end, counting the parts that may move.
  const fromEnd = new Map<string, number>();
  const clusters = new Map<string, number>();
  {
    const counts = [0, 0];
    for (let i = units.length - 1; i >= 0; i--) {
      const unit = units[i] as SolverUnit;
      const cluster = clusterOf(i);
      clusters.set(unit.id, cluster);
      if (unit.kind !== "unit") continue;
      fromEnd.set(unit.id, counts[cluster] ?? 0);
      counts[cluster] = (counts[cluster] ?? 0) + 1;
    }
  }

  const place = (current: Record<string, UnitView>): TriggerPlace | null => {
    const any = units.some(
      (unit) => unit.kind === "unit" && current[unit.id] === "overflow",
    );
    if (explicit) return permanent || any ? { at: "explicit" } : null;
    if (!any) return null;
    const first = units.findIndex(
      (unit) => unit.kind === "unit" && current[unit.id] === "overflow",
    );
    const spacer = units[lastSpacer];
    return clusterOf(first) === 0 && spacer
      ? { at: "before", id: spacer.id }
      : { at: "end" };
  };

  type Item = { kind: SolverUnit["kind"] | "trigger"; id: string; w: number };

  const base = input.overflowTriggerWidth;
  /** The ⋯'s width while it counts `active` parts set away from their defaults. */
  const triggerWidth = (active: number) =>
    active === 0
      ? base
      : active < 10
        ? (input.overflowTriggerCountWidth ?? base)
        : (input.overflowTriggerWideCountWidth ?? base);

  /** What stands on the bar, with the separators that part nothing hidden. */
  const lay = (current: Record<string, UnitView>) => {
    const trigger = place(current);
    const active = units.filter(
      (unit) =>
        unit.kind === "unit" && unit.active && current[unit.id] === "overflow",
    ).length;
    const w = triggerWidth(active);
    const items: Item[] = [];
    const triggerItem: Item = { kind: "trigger", id: "", w };
    for (const unit of units) {
      if (trigger?.at === "before" && trigger.id === unit.id) {
        items.push(triggerItem);
      }
      const view = current[unit.id];
      if (unit.kind === "overflow") {
        if (trigger) {
          // A permanent one is measured in place, without its count.
          items.push({
            kind: "trigger",
            id: unit.id,
            w: permanent ? unit.width + w - base : w,
          });
        }
        continue;
      }
      if (view === "overflow") continue;
      items.push({
        kind: unit.kind,
        id: unit.id,
        w: unit.kind === "spacer" ? 0 : widthIn(unit, view ?? "bar"),
      });
    }
    if (trigger?.at === "end") items.push(triggerItem);
    const hidden = new Set<string>();
    const content = (item: Item | undefined) =>
      item !== undefined && (item.kind === "unit" || item.kind === "fixed");
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Item;
      if (item.kind !== "separator") continue;
      let before: Item | undefined;
      for (let j = i - 1; j >= 0; j--) {
        const each = items[j] as Item;
        if (each.kind === "separator") {
          // Of a run of separators between the same two parts, the first stays.
          if (!hidden.has(each.id)) {
            before = undefined;
            break;
          }
          continue;
        }
        before = each;
        break;
      }
      let after: Item | undefined;
      for (let j = i + 1; j < items.length; j++) {
        const each = items[j] as Item;
        if (each.kind === "separator") continue;
        after = each;
        break;
      }
      if (!content(before) || !content(after)) hidden.add(item.id);
    }
    const shown = items.filter((item) => !hidden.has(item.id));
    const total =
      shown.reduce((sum, item) => sum + item.w, 0) +
      input.gap * Math.max(shown.length - 1, 0);
    return { trigger, hidden, total };
  };

  const finish = (
    current: Record<string, UnitView>,
    extra: { takeover?: boolean; scrollable?: boolean } = {},
  ): SolverResult => {
    const { trigger, hidden } = lay(current);
    for (const id of hidden) current[id] = "hidden";
    if (explicit && !trigger) current[explicit.id] = "hidden";
    const overflow: string[] = [];
    const breaks: string[] = [];
    let activeCount = 0;
    let previous = -1;
    for (let i = 0; i < units.length; i++) {
      const unit = units[i] as SolverUnit;
      if (unit.kind !== "unit" || current[unit.id] !== "overflow") continue;
      if (previous >= 0) {
        const before = units[previous] as SolverUnit;
        const parted =
          before.group ||
          unit.group ||
          clusters.get(before.id) !== clusters.get(unit.id) ||
          units
            .slice(previous + 1, i)
            .some((between) => between.kind === "separator");
        if (parted) breaks.push(unit.id);
      }
      overflow.push(unit.id);
      if (unit.active) activeCount++;
      previous = i;
    }
    return {
      views: current,
      overflow,
      breaks,
      trigger,
      activeCount,
      takeover: extra.takeover ?? false,
      scrollable: extra.scrollable ?? false,
    };
  };

  if (input.availableWidth <= 0) return finish(views);

  const steps: FoldStep<UnitView>[] = [];
  const byPriority = new Map<number, string[]>();
  units.forEach((unit, index) => {
    if (unit.kind !== "unit" || unit.held !== undefined) return;
    const key = (stage: number, active = 0) => [
      stage,
      rank(unit.priority),
      active,
      clusterOf(index),
      fromEnd.get(unit.id) ?? 0,
    ];
    if (!input.coarsePointer && unit.labelWidth !== undefined) {
      const p = rank(unit.priority);
      byPriority.set(p, [...(byPriority.get(p) ?? []), unit.id]);
    }
    if (unit.dropdownWidth !== undefined) {
      steps.push({ key: key(3), ids: [unit.id], view: "dropdown" });
    }
    if (unit.iconWidth !== undefined && !unit.pinned) {
      steps.push({ key: key(4), ids: [unit.id], view: "icon" });
    }
    if (unit.overflowable) {
      steps.push({
        key: key(unit.priority === "pin" ? 6 : 5, unit.active ? 1 : 0),
        ids: [unit.id],
        view: "overflow",
      });
    }
  });
  for (const [p, ids] of byPriority) {
    steps.push({ key: [2, p], ids, view: "label" });
  }
  const folded = foldSteps(
    views,
    sortSteps(steps),
    (current) => lay(current).total <= input.availableWidth,
  );
  if (folded.fitted) return finish(folded.views);
  if (units.some((unit) => unit.pinned)) {
    return finish(folded.views, { takeover: true });
  }
  return finish(folded.views, { scrollable: true });
}
