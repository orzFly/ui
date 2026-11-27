import { describe, expect, it } from "vitest";
import {
  solveTabNav,
  type TabNavPart,
} from "../src/components/tab-nav/solve.ts";

const link = (id: string, width: number, current = false): TabNavPart => ({
  id,
  kind: "link",
  width,
  current,
});

/** List 40, Board 50, Insights 70, Settings 60: 220 in all, the ⋯ 30. */
const sections = (current?: string) => [
  link("list", 40, current === "list"),
  link("board", 50, current === "board"),
  link("insights", 70, current === "insights"),
  link("settings", 60, current === "settings"),
];

const solve = (available: number, parts: TabNavPart[], currentName?: string) =>
  solveTabNav({ available, triggerWidth: 30, parts, currentName });

describe("solveTabNav", () => {
  it("folds nothing and shows no ⋯ when every link fits", () => {
    const layout = solve(220, sections("board"));
    expect(layout.overflow).toEqual([]);
    expect(layout.more).toBe(false);
    expect(layout.currentFolded).toBe(false);
    expect(layout.full).toBe(220);
  });

  it("folds from the end until what is left and the ⋯ fit", () => {
    // Settings out leaves 160 and 30; Insights too, 90 and 30.
    expect(solve(190, sections()).overflow).toEqual(["settings"]);
    expect(solve(189, sections()).overflow).toEqual(["insights", "settings"]);
    expect(solve(189, sections()).more).toBe(true);
  });

  it("passes over the current link", () => {
    // Settings, then Board, as Insights is current: 110 and 30.
    expect(solve(150, sections("insights")).overflow).toEqual([
      "board",
      "settings",
    ]);
    expect(solve(150, sections("insights")).views.insights).toBe("bar");
  });

  it("folds the current link last, leaving only the ⋯", () => {
    // Insights and the ⋯ need 100.
    const layout = solve(99, sections("insights"), "Insights");
    expect(layout.overflow).toEqual(["list", "board", "insights", "settings"]);
    expect(layout.currentFolded).toBe(true);
    expect(layout.currentName).toBe("Insights");
    expect(layout.least).toBe(100);
  });

  it("folds every link before the ⋯ alone without a current one", () => {
    const layout = solve(60, sections());
    expect(layout.overflow).toEqual(["list", "board", "insights", "settings"]);
    expect(layout.currentFolded).toBe(false);
    expect(layout.least).toBe(30);
    expect(layout.currentName).toBeNull();
  });

  it("counts a child it does not know, never folds it, and counts it in the least", () => {
    const parts = [
      ...sections("list"),
      { id: "fixed-0", kind: "fixed", width: 25 } as const,
    ];
    const layout = solve(100, parts);
    expect(layout.full).toBe(245);
    // List, the child and the ⋯.
    expect(layout.least).toBe(95);
    expect(layout.overflow).toEqual(["board", "insights", "settings"]);
    expect(layout.views["fixed-0"]).toBeUndefined();
  });

  it("takes the gap between parts", () => {
    const layout = solveTabNav({
      available: 200,
      triggerWidth: 30,
      gap: 4,
      parts: sections(),
    });
    expect(layout.full).toBe(232);
    // List, Board and the ⋯: 120 and two gaps.
    expect(layout.overflow).toEqual(["insights", "settings"]);
  });

  it("keeps the least at the full width when only the current link is there", () => {
    const layout = solve(10, [link("list", 40, true)]);
    expect(layout.least).toBe(layout.full);
    expect(layout.full).toBe(40);
  });

  it("folds nothing while it is out of sight", () => {
    expect(solve(0, sections("list")).overflow).toEqual([]);
    expect(solve(-5, sections("list")).more).toBe(false);
  });

  it("answers by the width alone, whatever it answered before", () => {
    const widths = [220, 189, 150, 99, 60, 99, 150, 189, 220];
    const there = widths.map((w) => solve(w, sections("board")).overflow);
    const back = [...widths]
      .reverse()
      .map((w) => solve(w, sections("board")).overflow)
      .reverse();
    expect(back).toEqual(there);
    expect(there[0]).toEqual([]);
    expect(there[4]).toEqual(["list", "board", "insights", "settings"]);
  });
});
