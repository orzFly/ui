import { describe, expect, it } from "vitest";
import { markerOf } from "../src/index.ts";
import { contrast, rgbOf } from "../src/rgb.ts";

const icon = (primary: string, square: string) =>
  contrast(rgbOf(primary), rgbOf(square));

describe("markerOf", () => {
  it("tints the fill 12% toward primary", () => {
    expect(
      markerOf({
        primary: "#1f3d6b",
        muted: "#eff3f9",
        background: "#ffffff",
      }),
    ).toBe("#d6dde8");
  });

  it("tints less where the full tint would drop the icon under 4.5:1", () => {
    const primary = "#5a6b80";
    const square = markerOf({
      primary,
      muted: "#f2f2f2",
      background: "#ffffff",
    });
    expect(square).not.toBe("#f2f2f2");
    expect(icon(primary, square)).toBeGreaterThanOrEqual(4.5);
  });

  it("steps away from the fill when primary on it is already under 4.5:1", () => {
    const primary = "oklch(0.72 0.14 245)";
    const muted = "oklch(0.45 0.013 263)";
    const square = markerOf({ primary, muted, background: "oklch(0.3 0 0)" });
    expect(icon(primary, muted)).toBeLessThan(4.5);
    expect(icon(primary, square)).toBeGreaterThanOrEqual(4.5);
    // Darker than the fill: a light icon stands out from black.
    expect(rgbOf(square)[0]).toBeLessThan(rgbOf(muted)[0]);
  });

  it("reads a translucent fill over the page", () => {
    const square = markerOf({
      primary: "oklch(0.9 0 0)",
      muted: "oklch(1 0 0 / 10%)",
      background: "oklch(0.2 0 0)",
    });
    expect(square).toMatch(/^#[0-9a-f]{6}$/);
  });
});
