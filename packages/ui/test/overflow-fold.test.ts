import { describe, expect, it } from "vitest";
import {
  type FoldStep,
  foldSteps,
  sortSteps,
} from "../src/components/overflow/fold.ts";

type View = "bar" | "small" | "overflow";

const widths: Record<string, Record<View, number>> = {
  a: { bar: 40, small: 20, overflow: 0 },
  b: { bar: 40, small: 20, overflow: 0 },
  c: { bar: 40, small: 20, overflow: 0 },
};

const total = (views: Readonly<Record<string, View>>) =>
  Object.entries(views).reduce(
    (sum, [id, view]) => sum + (widths[id]?.[view] ?? 0),
    0,
  );

const initial: Record<string, View> = { a: "bar", b: "bar", c: "bar" };

const steps: FoldStep<View>[] = [
  { key: [1, 0], ids: ["c"], view: "overflow" },
  { key: [0], ids: ["a", "b", "c"], view: "small" },
  { key: [1, 1], ids: ["b"], view: "overflow" },
];

describe("foldSteps", () => {
  it("returns the views as they are when they fit already", () => {
    const result = foldSteps(initial, sortSteps(steps), (v) => total(v) <= 120);
    expect(result).toEqual({ views: initial, fitted: true });
  });

  it("stops at the first step after which the row fits", () => {
    // Every part small is 60; c gone is 40 more off.
    expect(
      foldSteps(initial, sortSteps(steps), (v) => total(v) <= 60).views,
    ).toEqual({ a: "small", b: "small", c: "small" });
    expect(
      foldSteps(initial, sortSteps(steps), (v) => total(v) <= 59).views,
    ).toEqual({ a: "small", b: "small", c: "overflow" });
  });

  it("takes every step and says so when nothing fits", () => {
    const result = foldSteps(initial, sortSteps(steps), () => false);
    expect(result).toEqual({
      views: { a: "small", b: "overflow", c: "overflow" },
      fitted: false,
    });
  });

  it("leaves the views it was given untouched", () => {
    const given = { ...initial };
    foldSteps(given, sortSteps(steps), () => false);
    expect(given).toEqual(initial);
  });
});

describe("sortSteps", () => {
  it("orders by key, element by element, a missing element as 0", () => {
    expect(sortSteps(steps).map((step) => step.key)).toEqual([
      [0],
      [1, 0],
      [1, 1],
    ]);
  });

  it("keeps the given order between equal keys", () => {
    const tied: FoldStep<View>[] = [
      { key: [1], ids: ["c"], view: "overflow" },
      { key: [1, 0], ids: ["a"], view: "overflow" },
      { key: [0], ids: ["b"], view: "overflow" },
      { key: [1], ids: ["b"], view: "small" },
    ];
    expect(sortSteps(tied).map((step) => step.ids[0])).toEqual([
      "b",
      "c",
      "a",
      "b",
    ]);
    // The table given is not reordered in place.
    expect(tied[0]?.ids).toEqual(["c"]);
  });
});
