import { describe, expect, it } from "vitest";
import {
  EDGE_PX,
  EDGE_SPEED,
  edgeScrollBy,
  scrollerEdges,
  scrollerOf,
} from "../src/lib/edge-scroll.ts";

const TOP = 100;
const BOTTOM = 500;

describe("edgeScrollBy", () => {
  it("is 0 outside both bands", () => {
    expect(edgeScrollBy(TOP + EDGE_PX, TOP, BOTTOM)).toBe(0);
    expect(edgeScrollBy(300, TOP, BOTTOM)).toBe(0);
    expect(edgeScrollBy(BOTTOM - EDGE_PX, TOP, BOTTOM)).toBe(0);
  });

  it("scrolls up near the top, faster the nearer it is", () => {
    expect(edgeScrollBy(TOP, TOP, BOTTOM)).toBe(-EDGE_SPEED);
    expect(edgeScrollBy(TOP + 20, TOP, BOTTOM)).toBe(-9);
    expect(edgeScrollBy(TOP + 39, TOP, BOTTOM)).toBe(-1);
  });

  it("scrolls down near the bottom, faster the nearer it is", () => {
    expect(edgeScrollBy(BOTTOM, TOP, BOTTOM)).toBe(EDGE_SPEED);
    expect(edgeScrollBy(BOTTOM - 20, TOP, BOTTOM)).toBe(9);
    expect(edgeScrollBy(BOTTOM - 39, TOP, BOTTOM)).toBe(1);
  });

  it("takes the top speed past an edge", () => {
    expect(edgeScrollBy(TOP - 30, TOP, BOTTOM)).toBe(-EDGE_SPEED);
    expect(edgeScrollBy(BOTTOM + 30, TOP, BOTTOM)).toBe(EDGE_SPEED);
  });
});

describe("scrollerOf and scrollerEdges", () => {
  it("finds the nearest scrolling ancestor, and none on a page", () => {
    const outer = document.createElement("div");
    outer.style.overflowY = "auto";
    const inner = document.createElement("div");
    const el = document.createElement("div");
    inner.append(el);
    outer.append(inner);
    document.body.append(outer);
    expect(scrollerOf(el)).toBe(outer);
    outer.style.overflowY = "visible";
    expect(scrollerOf(el)).toBeUndefined();
    outer.remove();
  });

  it("reads the window's edges when nothing scrolls", () => {
    const el = document.createElement("div");
    document.body.append(el);
    expect(scrollerEdges(el, undefined)).toEqual({
      top: 0,
      bottom: window.innerHeight,
    });
    el.remove();
  });
});
