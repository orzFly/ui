import { describe, expect, it } from "vitest";
import {
  type SolverInput,
  type SolverUnit,
  solveToolbar,
} from "../src/components/toolbar/solver.ts";

const unit = (id: string, width: number, extra: Partial<SolverUnit> = {}) =>
  ({
    id,
    kind: "unit",
    width,
    overflowable: true,
    ...extra,
  }) satisfies SolverUnit;
const sep = (id: string): SolverUnit => ({ id, kind: "separator", width: 9 });
const spacer = (id = "spacer"): SolverUnit => ({
  id,
  kind: "spacer",
  width: 0,
});

const run = (
  availableWidth: number,
  units: SolverUnit[],
  extra: Partial<SolverInput> = {},
) =>
  solveToolbar({
    availableWidth,
    gap: 0,
    overflowTriggerWidth: 20,
    coarsePointer: false,
    units,
    ...extra,
  });

/** Every width from wide to narrow and back, as a sequence of results. */
function sweep(units: SolverUnit[], extra: Partial<SolverInput> = {}) {
  const widths: number[] = [];
  for (let w = 400; w >= 10; w -= 3) widths.push(w);
  return widths.map((w) => JSON.stringify(run(w, units, extra)));
}

describe("solveToolbar", () => {
  it("leaves everything in full when it fits", () => {
    const result = run(100, [unit("a", 50), unit("b", 50)]);
    expect(result.views).toEqual({ a: "bar", b: "bar" });
    expect(result.overflow).toEqual([]);
    expect(result.trigger).toBeNull();
  });

  it("lays out nothing before the row has a width", () => {
    const result = run(0, [unit("a", 500), unit("b", 500)]);
    expect(result.overflow).toEqual([]);
    expect(result.views).toEqual({ a: "bar", b: "bar" });
  });

  it("counts the gap between every part, spacers included", () => {
    const units = [unit("a", 40), spacer(), unit("b", 40)];
    expect(run(100, units, { gap: 10 }).overflow).toEqual([]);
    expect(run(99, units, { gap: 10 }).overflow).not.toEqual([]);
  });

  it("moves parts from the end into ⋯, reserving its width", () => {
    const result = run(100, [unit("a", 40), unit("b", 40), unit("c", 40)]);
    // a + b = 80, plus the ⋯'s 20.
    expect(result.views).toMatchObject({ a: "bar", b: "bar", c: "overflow" });
    expect(result.trigger).toEqual({ at: "end" });
  });

  it("takes the ⋯'s width into account before it stops", () => {
    const result = run(95, [unit("a", 40), unit("b", 40), unit("c", 40)]);
    expect(result.overflow).toEqual(["b", "c"]);
  });

  it("moves lower priorities first, whatever their place", () => {
    const result = run(100, [
      unit("a", 40, { priority: -1 }),
      unit("b", 40),
      unit("c", 40, { priority: 1 }),
    ]);
    expect(result.overflow).toEqual(["a"]);
  });

  it("moves a part set away from its default last within its priority", () => {
    const result = run(100, [
      unit("a", 40),
      unit("b", 40),
      unit("c", 40, { active: true }),
    ]);
    expect(result.overflow).toEqual(["b"]);
    expect(result.activeCount).toBe(0);
    const narrow = run(30, [
      unit("a", 40),
      unit("b", 40),
      unit("c", 40, { active: true }),
    ]);
    expect(narrow.activeCount).toBe(1);
  });

  it("widens the ⋯ by its count of the parts in it set away from their defaults", () => {
    const counted = {
      overflowTriggerCountWidth: 36,
      overflowTriggerWideCountWidth: 44,
    };
    const units = [
      unit("a", 40),
      unit("b", 40),
      unit("c", 40, { active: true, priority: -1 }),
    ];
    // Without c: a + b + the counted ⋯ is 116, so b goes too.
    expect(run(110, units).overflow).toEqual(["c"]);
    const result = run(110, units, counted);
    expect(result.overflow).toEqual(["b", "c"]);
    expect(result.activeCount).toBe(1);
    // A part at its default moved into the ⋯ leaves it as it was.
    const plain = [unit("a", 40), unit("b", 40), unit("c", 40)];
    expect(run(100, plain, counted).overflow).toEqual(["c"]);
  });

  it("takes the widest count's width from ten parts set away", () => {
    const units = Array.from({ length: 10 }, (_, i) =>
      unit(`f${i}`, 40, { active: true }),
    );
    const extra = {
      overflowTriggerCountWidth: 36,
      overflowTriggerWideCountWidth: 44,
    };
    // Nine in the ⋯ with one left: 40 + 36. All ten: 44 alone.
    expect(run(76, units, extra).overflow).toHaveLength(9);
    expect(run(75, units, extra).overflow).toHaveLength(10);
    expect(run(44, units, extra).scrollable).toBe(false);
    expect(run(43, units, extra).scrollable).toBe(true);
  });

  it("widens a permanent ToolbarOverflow's ⋯ by the same count", () => {
    const units = [
      unit("a", 40),
      unit("b", 40, { active: true, priority: -1 }),
      { id: "more", kind: "overflow", width: 26 } satisfies SolverUnit,
    ];
    const extra = {
      permanentOverflow: true,
      overflowTriggerCountWidth: 36,
    };
    // b in the ⋯: a + the ⋯ at 26 + 16 = 82.
    expect(run(82, units, extra).overflow).toEqual(["b"]);
    expect(run(81, units, extra).overflow).toEqual(["a", "b"]);
  });

  it("hides labels of one priority together, on a fine pointer, before moving anything", () => {
    const units = [
      unit("a", 60, { labelWidth: 30 }),
      unit("b", 60, { labelWidth: 30 }),
      unit("c", 60, { labelWidth: 30, priority: 1 }),
    ];
    const result = run(150, units);
    expect(result.views).toMatchObject({ a: "label", b: "label", c: "bar" });
    expect(result.overflow).toEqual([]);
  });

  it("skips hiding labels on a coarse pointer, moving parts instead", () => {
    const units = [
      unit("a", 60, { labelWidth: 30 }),
      unit("b", 60, { labelWidth: 30 }),
      unit("c", 60, { labelWidth: 30, priority: 1 }),
    ];
    const result = run(150, units, { coarsePointer: true });
    expect(result.views).toMatchObject({ a: "bar", b: "overflow", c: "bar" });
  });

  it("turns a segmented control into a dropdown before moving parts", () => {
    const result = run(100, [
      unit("seg", 90, { dropdownWidth: 40 }),
      unit("b", 40),
    ]);
    expect(result.views).toMatchObject({ seg: "dropdown", b: "bar" });
  });

  it("turns an empty search into its icon, but not a pinned one", () => {
    const units = [
      unit("search", 160, { iconWidth: 28, overflowable: false }),
      unit("b", 40),
    ];
    expect(run(100, units).views).toMatchObject({ search: "icon", b: "bar" });
    const pinned = [
      unit("search", 160, { iconWidth: 28, overflowable: false, pinned: true }),
      unit("b", 40),
    ];
    const result = run(185, pinned);
    expect(result.views).toMatchObject({ search: "bar", b: "overflow" });
    expect(result.takeover).toBe(false);
  });

  it("gives a pinned search the whole bar when it does not fit beside the ⋯", () => {
    const result = run(170, [
      unit("search", 160, { iconWidth: 28, overflowable: false, pinned: true }),
      unit("b", 40),
    ]);
    expect(result.takeover).toBe(true);
  });

  it("moves the cluster before the last spacer first, and puts the ⋯ at its end", () => {
    const result = run(140, [
      unit("a", 40),
      unit("b", 40),
      spacer(),
      unit("c", 40),
      unit("d", 40),
    ]);
    expect(result.overflow).toEqual(["b"]);
    expect(result.trigger).toEqual({ at: "before", id: "spacer" });
  });

  it("puts the ⋯ at the end when only the last cluster overflows", () => {
    const result = run(60, [spacer(), unit("c", 40), unit("d", 40)]);
    expect(result.overflow).toEqual(["d"]);
    expect(result.trigger).toEqual({ at: "end" });
  });

  it("keeps a ToolbarOverflow's ⋯ where it is, and shows a permanent one always", () => {
    const units = [
      unit("a", 40),
      unit("b", 40),
      { id: "more", kind: "overflow", width: 20 } satisfies SolverUnit,
      unit("c", 40),
    ];
    expect(run(200, units).trigger).toBeNull();
    expect(run(200, units).views.more).toBe("hidden");
    expect(run(200, units, { permanentOverflow: true }).trigger).toEqual({
      at: "explicit",
    });
    // A permanent ⋯ is counted from the start.
    expect(run(130, units, { permanentOverflow: true }).overflow).toEqual([
      "c",
    ]);
    expect(run(130, units).overflow).toEqual([]);
  });

  it("never splits a group, which is one unit", () => {
    const result = run(110, [unit("group", 90), unit("b", 40)]);
    expect(result.overflow).toEqual(["b"]);
    const narrow = run(50, [unit("group", 90), unit("b", 40)]);
    expect(narrow.overflow).toEqual(["group", "b"]);
  });

  it("hides separators that part nothing", () => {
    const result = run(100, [
      unit("a", 40),
      sep("s1"),
      unit("b", 40),
      sep("s2"),
      unit("c", 40),
    ]);
    // c overflows, so s2 sits against the ⋯; b overflows too, so s1 does.
    expect(result.overflow).toEqual(["b", "c"]);
    expect(result.views).toMatchObject({ s1: "hidden", s2: "hidden" });
    const wide = run(400, [
      sep("lead"),
      unit("a", 40),
      sep("s1"),
      sep("s2"),
      unit("b", 40),
      sep("tail"),
    ]);
    expect(wide.views).toMatchObject({
      lead: "hidden",
      s1: "bar",
      s2: "hidden",
      tail: "hidden",
    });
  });

  it("parts menu items where the bar had a separator, a group or another cluster", () => {
    const result = run(10, [
      unit("a", 40),
      unit("b", 40),
      sep("s"),
      unit("c", 40),
      unit("g", 40, { group: true }),
      spacer(),
      unit("d", 40),
    ]);
    expect(result.overflow).toEqual(["a", "b", "c", "g", "d"]);
    expect(result.breaks).toEqual(["c", "g", "d"]);
  });

  it("leaves parts undisplayed by CSS out of the count and the menu", () => {
    const result = run(100, [
      unit("hidden", 500, { cssHidden: true }),
      unit("a", 50),
      unit("b", 50),
    ]);
    expect(result.overflow).toEqual([]);
    expect(result.views.hidden).toBe("bar");
  });

  it("moves pinned parts with a menu form last, then scrolls rather than clip", () => {
    const units = [
      unit("a", 40),
      unit("pin", 60, { priority: "pin" }),
      unit("fixed", 60, { priority: "pin", overflowable: false }),
    ];
    const tight = run(140, units);
    expect(tight.overflow).toEqual(["a"]);
    const tighter = run(90, units);
    expect(tighter.overflow).toEqual(["a", "pin"]);
    expect(tighter.scrollable).toBe(false);
    const tightest = run(50, units);
    expect(tightest.scrollable).toBe(true);
  });

  it("counts a child the toolbar does not know at its width, and never moves it", () => {
    const result = run(110, [
      { id: "title", kind: "fixed", width: 50 },
      unit("a", 40),
      unit("b", 40),
    ]);
    expect(result.overflow).toEqual(["b"]);
  });

  it("only ever takes parts off the bar as the width shrinks", () => {
    const units = [
      unit("title", 50, { overflowable: false, priority: "pin" }),
      unit("search", 160, { iconWidth: 28, overflowable: false }),
      unit("f1", 70, { labelWidth: 40 }),
      unit("f2", 70, { active: true }),
      sep("s"),
      unit("seg", 90, { dropdownWidth: 50 }),
      spacer(),
      unit("new", 80, { priority: "pin" }),
    ];
    // Each narrower width's answer applies a longer run of the same steps,
    // so widening takes them back in reverse and nothing flips, however
    // wide the ⋯'s count makes it.
    for (const extra of [
      {},
      { overflowTriggerCountWidth: 36, overflowTriggerWideCountWidth: 44 },
    ]) {
      let onBar = Number.POSITIVE_INFINITY;
      let moved: string[] = [];
      for (const each of sweep(
        [...units, unit("f3", 60, { active: true, priority: -1 })],
        extra,
      )) {
        const result = JSON.parse(each) as ReturnType<typeof run>;
        const count = Object.values(result.views).filter(
          (view) => view === "bar",
        ).length;
        expect(count).toBeLessThanOrEqual(onBar);
        expect(result.overflow).toEqual(expect.arrayContaining(moved));
        onBar = count;
        moved = result.overflow;
      }
    }
  });
});
