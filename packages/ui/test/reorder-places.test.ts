import { describe, expect, it, vi } from "vitest";
import {
  moveInGroups,
  moveItem,
  nearestPlace,
  placesOf,
  positionOf,
  type ReorderPosition,
  samePlace,
  stepPlace,
} from "../src/lib/reorder-places.ts";

const LIST = [{ items: ["a", "b", "c"] }];
const GROUPS = [
  { id: "first", items: ["a", "b"] },
  { id: "second", items: ["c", "d", "e"] },
  { id: "empty", items: [] },
];

const at = (group: string, index: number) => ({ group, index });

describe("samePlace and positionOf", () => {
  it("compares group and index", () => {
    expect(samePlace({ index: 1 }, { index: 1 })).toBe(true);
    expect(samePlace(at("first", 1), at("second", 1))).toBe(false);
    expect(samePlace(at("first", 1), at("first", 0))).toBe(false);
  });

  it("finds a row in a list and in groups, and nothing for a stranger", () => {
    expect(positionOf(LIST, "b")).toEqual({ index: 1 });
    expect(positionOf(LIST, "b")).not.toHaveProperty("group");
    expect(positionOf(GROUPS, "d")).toEqual(at("second", 1));
    expect(positionOf(GROUPS, "z")).toBeUndefined();
  });
});

describe("placesOf", () => {
  it("lists a list's places, its own once", () => {
    expect(placesOf(LIST, "b")).toEqual([
      { index: 0 },
      { index: 1 },
      { index: 2 },
    ]);
  });

  it("lists each group's places in order, an empty group's 0 alone", () => {
    expect(placesOf(GROUPS, "a")).toEqual([
      at("first", 0),
      at("first", 1),
      at("second", 0),
      at("second", 1),
      at("second", 2),
      at("second", 3),
      at("empty", 0),
    ]);
  });

  it("holds the row's own place exactly once", () => {
    const places = placesOf(GROUPS, "d");
    const own = positionOf(GROUPS, "d") as ReorderPosition;
    expect(places.filter((p) => samePlace(p, own))).toHaveLength(1);
    expect(places).toHaveLength(2 + 1 + 3 + 1);
  });

  it("gives a row no group holds every group's 0…n", () => {
    expect(placesOf(GROUPS, "z")).toHaveLength(3 + 4 + 1);
  });
});

describe("stepPlace", () => {
  it("steps within a group", () => {
    expect(stepPlace(GROUPS, "d", -1)).toEqual(at("second", 0));
    expect(stepPlace(GROUPS, "d", 1)).toEqual(at("second", 2));
    expect(stepPlace(LIST, "b", 1)).toEqual({ index: 2 });
  });

  it("steps from a group's top to the end of the one above", () => {
    expect(stepPlace(GROUPS, "c", -1)).toEqual(at("first", 2));
  });

  it("steps from a group's bottom to the start of the one below", () => {
    expect(stepPlace(GROUPS, "b", 1)).toEqual(at("second", 0));
  });

  it("steps into an empty group, and back out of it", () => {
    expect(stepPlace(GROUPS, "e", 1)).toEqual(at("empty", 0));
    const moved = [
      { id: "first", items: ["a", "b"] },
      { id: "second", items: ["c", "d"] },
      { id: "empty", items: ["e"] },
    ];
    expect(stepPlace(moved, "e", -1)).toEqual(at("second", 2));
  });

  it("skips the places canDrop refuses", () => {
    const canDrop = (_: string, to: ReorderPosition) => to.group !== "first";
    expect(stepPlace(GROUPS, "c", -1, canDrop)).toBeUndefined();
    const notOne = (_: string, to: ReorderPosition) => to.index !== 1;
    expect(stepPlace(GROUPS, "c", 1, notOne)).toEqual(at("second", 2));
  });

  it("has nowhere to go past either end", () => {
    expect(stepPlace(LIST, "a", -1)).toBeUndefined();
    expect(stepPlace(LIST, "c", 1)).toBeUndefined();
    expect(stepPlace(GROUPS, "z", 1)).toBeUndefined();
  });

  it("never asks canDrop about the row's own place", () => {
    const canDrop = vi.fn(() => false);
    stepPlace(GROUPS, "d", -1, canDrop);
    stepPlace(GROUPS, "d", 1, canDrop);
    expect(canDrop).toHaveBeenCalled();
    for (const [, to] of canDrop.mock.calls as unknown as [
      string,
      ReorderPosition,
    ][])
      expect(samePlace(to, at("second", 1))).toBe(false);
  });
});

describe("nearestPlace", () => {
  it("keeps a candidate canDrop accepts", () => {
    expect(nearestPlace(GROUPS, "c", at("first", 1))).toEqual(at("first", 1));
    expect(nearestPlace(GROUPS, "c", at("first", 1), () => true)).toEqual(
      at("first", 1),
    );
  });

  it("takes the accepted place nearest a refused one", () => {
    // Refuses the whole first group: the nearest is the second's 0, c's own.
    const notFirst = (_: string, to: ReorderPosition) => to.group !== "first";
    expect(nearestPlace(GROUPS, "c", at("first", 0), notFirst)).toEqual(
      at("second", 0),
    );
    const notTwo = (_: string, to: ReorderPosition) =>
      !(to.group === "second" && to.index === 2);
    expect(nearestPlace(GROUPS, "a", at("second", 2), notTwo)).toEqual(
      at("second", 1),
    );
  });

  it("breaks a tie toward the row's own place", () => {
    // Places of "a": first 0 1, second 0 1 2 3, empty 0. Refusing second 1
    // leaves second 0 and second 2 one step away; second 0 is nearer a's.
    const notOne = (_: string, to: ReorderPosition) =>
      !(to.group === "second" && to.index === 1);
    expect(nearestPlace(GROUPS, "a", at("second", 1), notOne)).toEqual(
      at("second", 0),
    );
    // e's own place is second 2; refusing second 1 now leans the other way.
    expect(nearestPlace(GROUPS, "e", at("second", 1), notOne)).toEqual(
      at("second", 2),
    );
  });

  it("falls back to the row's own place when nothing else is accepted", () => {
    expect(nearestPlace(GROUPS, "d", at("empty", 0), () => false)).toEqual(
      at("second", 1),
    );
  });

  it("never asks canDrop about the row's own place", () => {
    const canDrop = vi.fn(() => false);
    nearestPlace(GROUPS, "d", at("first", 0), canDrop);
    for (const [, to] of canDrop.mock.calls as unknown as [
      string,
      ReorderPosition,
    ][])
      expect(samePlace(to, at("second", 1))).toBe(false);
  });
});

describe("moveItem", () => {
  const items = ["a", "b", "c", "d"];
  const move = (from: number, to: number) =>
    moveItem(items, { from: { index: from }, to: { index: to } });

  it("moves forward and back", () => {
    expect(move(0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(move(3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("moves to either end, and in place", () => {
    expect(move(1, 0)).toEqual(["b", "a", "c", "d"]);
    expect(move(1, 3)).toEqual(["a", "c", "d", "b"]);
    expect(move(2, 2)).toEqual(items);
  });

  it("leaves the array it was given as it is", () => {
    const before = items.slice();
    const after = move(0, 3);
    expect(items).toEqual(before);
    expect(after).not.toBe(items);
  });
});

describe("moveInGroups", () => {
  type Group = { id: string; name: string; items: readonly string[] };
  const groups: Group[] = [
    { id: "first", name: "First", items: ["a", "b"] },
    { id: "second", name: "Second", items: ["c", "d", "e"] },
    { id: "empty", name: "Empty", items: [] },
  ];

  it("moves within a group, leaving the rest the same objects", () => {
    const next = moveInGroups(groups, {
      from: at("second", 0),
      to: at("second", 2),
    });
    expect(next[1]).toEqual({
      id: "second",
      name: "Second",
      items: ["d", "e", "c"],
    });
    expect(next[0]).toBe(groups[0]);
    expect(next[2]).toBe(groups[2]);
  });

  it("moves across groups", () => {
    const next = moveInGroups(groups, {
      from: at("second", 1),
      to: at("first", 1),
    });
    expect(next.map((g) => g.items)).toEqual([["a", "d", "b"], ["c", "e"], []]);
    expect(next[2]).toBe(groups[2]);
  });

  it("moves into an empty group, and empties one", () => {
    const into = moveInGroups(groups, {
      from: at("first", 0),
      to: at("empty", 0),
    });
    expect(into.map((g) => g.items)).toEqual([["b"], ["c", "d", "e"], ["a"]]);
    const out = moveInGroups(into, {
      from: at("empty", 0),
      to: at("second", 3),
    });
    expect(out.map((g) => g.items)).toEqual([["b"], ["c", "d", "e", "a"], []]);
  });

  it("changes neither the array nor the groups it was given", () => {
    const before = structuredClone(groups);
    const next = moveInGroups(groups, {
      from: at("first", 0),
      to: at("second", 0),
    });
    expect(groups).toEqual(before);
    expect(next).not.toBe(groups);
    expect(next[0]).not.toBe(groups[0]);
    expect(next[1]).not.toBe(groups[1]);
  });
});
