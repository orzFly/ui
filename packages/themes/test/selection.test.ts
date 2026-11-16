import { describe, expect, it } from "vitest";
import { SELECTION_APART, selectionOf } from "../src/index.ts";
import { contrast, distance, rgbOf } from "../src/rgb.ts";

const light = {
  background: "#ffffff",
  foreground: "#0f1727",
  card: "#ffffff",
  popover: "#ffffff",
  muted: "#eff3f9",
  sidebar: "#eff3f9",
  primary: "#1f3d6b",
};

describe("selectionOf", () => {
  it("keeps a seed that already stands off every surface", () => {
    expect(selectionOf(light, "#add6ff")).toBe("#add6ff");
  });

  it("lays a translucent seed over the page", () => {
    expect(selectionOf(light, "#1f3d6b40")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("darkens a seed too close to the muted fill on a light page", () => {
    const fill = selectionOf(light, "#f0f4fa");
    expect(distance(rgbOf(fill), rgbOf(light.muted))).toBeGreaterThanOrEqual(
      SELECTION_APART,
    );
    expect(rgbOf(fill)[0]).toBeLessThan(0xf0);
  });

  it("lightens one on a dark page", () => {
    const dark = {
      ...light,
      background: "#141414",
      foreground: "#f5f5f5",
      card: "#141414",
      popover: "#141414",
      muted: "#262626",
      sidebar: "#262626",
    };
    const fill = selectionOf(dark, "#1a1a1a");
    expect(rgbOf(fill)[0]).toBeGreaterThan(0x26);
  });

  it("tints the page with primary when given no seed", () => {
    const fill = rgbOf(selectionOf(light));
    // A quarter of the way from white to #1f3d6b.
    expect(fill).toEqual([199, 207, 218]);
  });

  it("stops before its text falls under 4.5:1", () => {
    const fill = selectionOf({ ...light, foreground: "#666666" }, "#f0f4fa");
    expect(contrast(rgbOf("#666666"), rgbOf(fill))).toBeGreaterThanOrEqual(4.5);
  });
});
