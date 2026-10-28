import { describe, expect, it } from "vitest";
import { grayOf, oklchOf } from "../src/color.ts";
import { oklab, rgbOf } from "../src/rgb.ts";

const bytes = (hex: string) =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

describe("oklchOf", () => {
  it("lands within two steps of each channel, at three decimals", () => {
    for (const hex of ["#eff1f5", "#1e1e2e", "#8839ef", "#d20f39", "#000000"]) {
      const value = oklchOf(hex);
      expect(value).toMatch(/^oklch\([\d.]+ [\d.]+ [\d.]+\)$/);
      const off = rgbOf(value).map((v, i) => Math.abs(v - bytes(hex)[i]));
      expect(Math.max(...off), hex).toBeLessThanOrEqual(2);
    }
  });
});

describe("grayOf", () => {
  it("gives the neutral grey of the colour's OKLab lightness", () => {
    for (const hex of ["#4c4f69", "#eff1f5", "#11111b"]) {
      const gray = grayOf(hex);
      const [r, g, b] = bytes(gray);
      expect(r === g && g === b, gray).toBe(true);
      const lightness = (value: string) => oklab(oklchOf(value))[0];
      expect(lightness(gray)).toBeCloseTo(lightness(hex), 2);
    }
    expect(grayOf("#ffffff")).toBe("#ffffff");
    expect(grayOf("#000000")).toBe("#000000");
  });
});
