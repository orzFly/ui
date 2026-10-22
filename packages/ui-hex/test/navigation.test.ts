import { describe, expect, it } from "vitest";

import { type NavigationLayout, navigate } from "../src/navigation.ts";
import type { HexSelection } from "../src/types.ts";

// 100 bytes at 16 columns: rows 0..6, the last row holds 0x60..0x63.
const layout: NavigationLayout = {
  columns: 16,
  size: 100,
  pageRows: 4,
  maxOffset: 99,
  firstVisible: 32,
};

const at = (focus: number, anchor = focus): HexSelection => ({
  anchor,
  focus,
  pane: "hex",
});

const key = (k: string, shift = false, mod = false) => ({ key: k, shift, mod });

describe("navigate", () => {
  it("moves by byte, row, page and row edge", () => {
    expect(navigate(at(20), key("ArrowLeft"), layout)).toEqual(at(19));
    expect(navigate(at(20), key("ArrowRight"), layout)).toEqual(at(21));
    expect(navigate(at(20), key("ArrowUp"), layout)).toEqual(at(4));
    expect(navigate(at(20), key("ArrowDown"), layout)).toEqual(at(36));
    expect(navigate(at(20), key("PageDown"), layout)).toEqual(at(84));
    expect(navigate(at(84), key("PageUp"), layout)).toEqual(at(20));
    expect(navigate(at(20), key("Home"), layout)).toEqual(at(16));
    expect(navigate(at(20), key("End"), layout)).toEqual(at(31));
  });

  it("extends from the anchor with Shift", () => {
    expect(navigate(at(20), key("ArrowRight", true), layout)).toEqual(
      at(21, 20),
    );
    expect(navigate(at(21, 20), key("ArrowDown", true), layout)).toEqual(
      at(37, 20),
    );
    expect(navigate(at(21, 20), key("End", true), layout)).toEqual(at(31, 20));
    expect(navigate(at(21, 20), key("Home", true, true), layout)).toEqual(
      at(0, 20),
    );
    expect(navigate(at(21, 20), key("ArrowLeft"), layout)).toEqual(at(20));
  });

  it("jumps to the source edges and selects all with mod", () => {
    expect(navigate(at(20), key("Home", false, true), layout)).toEqual(at(0));
    expect(navigate(at(20), key("End", false, true), layout)).toEqual(at(99));
    expect(navigate(at(20), key("a", false, true), layout)).toEqual(at(99, 0));
    expect(navigate(null, key("a", false, true), layout)).toEqual(at(99, 0));
  });

  it("clears with Escape", () => {
    expect(navigate(at(20), key("Escape"), layout)).toBeNull();
  });

  it("clamps at both ends", () => {
    expect(navigate(at(0), key("ArrowLeft"), layout)).toEqual(at(0));
    expect(navigate(at(99), key("ArrowRight"), layout)).toEqual(at(99));
    expect(navigate(at(30), key("PageUp"), layout)).toEqual(at(14));
    expect(navigate(at(70), key("PageDown"), layout)).toEqual(at(99));
    expect(navigate(at(50), key("PageDown"), layout)).toEqual(at(98));
  });

  it("stays put on Up from the first row and Down from the last", () => {
    expect(navigate(at(5), key("ArrowUp"), layout)).toEqual(at(5));
    expect(navigate(at(90), key("ArrowDown"), layout)).toEqual(at(90));
    expect(navigate(at(80), key("ArrowDown"), layout)).toEqual(at(96));
  });

  it("stops End at the end of a short last row", () => {
    expect(navigate(at(97), key("End"), layout)).toEqual(at(99));
  });

  it("returns the same object when nothing changes", () => {
    const sel = at(0);
    expect(navigate(sel, key("ArrowLeft"), layout)).toBe(sel);
    const all = at(99, 0);
    expect(navigate(all, key("a", false, true), layout)).toBe(all);
  });

  it("starts at the first visible byte with no selection", () => {
    expect(navigate(null, key("ArrowDown"), layout)).toEqual(at(32));
    expect(navigate(null, key("ArrowRight", true), layout)).toEqual(at(32));
  });

  it("keeps the pane", () => {
    const sel: HexSelection = { anchor: 3, focus: 3, pane: "text" };
    expect(navigate(sel, key("ArrowRight"), layout)).toEqual({
      anchor: 4,
      focus: 4,
      pane: "text",
    });
  });

  it("ignores other keys", () => {
    expect(navigate(at(3), key("Tab"), layout)).toBeUndefined();
    expect(navigate(at(3), key("x"), layout)).toBeUndefined();
  });
});
