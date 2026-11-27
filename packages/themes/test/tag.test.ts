import { describe, expect, it } from "vitest";
import {
  defaultTheme,
  TAG_COLORS,
  TAG_HUES,
  tagBlend,
  tagColorsOf,
  tagFill,
} from "../src/index.ts";
import { contrast, labOf, oklab, rgbOf } from "../src/rgb.ts";
import { lchOf, mixOklch } from "../src/tag.ts";
import type { ColorScheme, Tokens } from "../src/types.ts";

const hueOf = (value: string) =>
  lchOf(value.startsWith("oklch(") ? oklab(value) : labOf(rgbOf(value)))[2];

describe("tagColorsOf", () => {
  // biome-ignore lint/style/noNonNullAssertion: the default theme has both sides
  const light = defaultTheme.light!.tokens;
  // biome-ignore lint/style/noNonNullAssertion: the default theme has both sides
  const dark = defaultTheme.dark!.tokens;

  it.each([
    ["light", light],
    ["dark", dark],
  ] as [ColorScheme, Tokens][])(
    "holds each colour at 4.65:1 on its own fill, at its own hue, on the %s side",
    (scheme, tokens) => {
      const tags = tagColorsOf(tokens, scheme);
      expect(Object.keys(tags)).toEqual(TAG_COLORS.map((c) => `tag-${c}`));
      for (const color of TAG_COLORS) {
        const ink = tags[`tag-${color}`];
        const fill = tagFill(ink, tokens.background, scheme);
        expect(contrast(rgbOf(ink), rgbOf(fill)), color).toBeGreaterThanOrEqual(
          4.65,
        );
        if (color !== "gray") {
          expect(Number(ink.split(" ")[2].replace(")", "")), color).toBe(
            TAG_HUES[color],
          );
        }
      }
    },
  );

  it("darkens on a light page and lightens on a dark one", () => {
    const lightness = (value: string) => oklab(value)[0];
    const day = tagColorsOf(light, "light");
    const night = tagColorsOf(dark, "dark");
    for (const color of TAG_COLORS) {
      expect(lightness(day[`tag-${color}`])).toBeLessThan(0.62 + 1e-9);
      expect(lightness(night[`tag-${color}`])).toBeGreaterThan(0.72 - 1e-9);
    }
  });

  it("gives gray the foreground's hue and at most a trace of chroma", () => {
    const { "tag-gray": gray } = tagColorsOf(light, "light");
    const [, chroma] = lchOf(oklab(gray));
    expect(chroma).toBeLessThanOrEqual(0.02);
    expect(hueOf(gray)).toBeCloseTo(hueOf(light.foreground), 0);
  });

  it("reads a background written as hex or as oklch()", () => {
    const hex = tagColorsOf(
      { background: "#ffffff", foreground: "#000000" },
      "light",
    );
    const oklch = tagColorsOf(
      { background: "oklch(1 0 0)", foreground: "oklch(0 0 0)" },
      "light",
    );
    expect(oklch).toEqual(hex);
  });
});

describe("tagFill", () => {
  it("mixes the colour into the page by the scheme's share", () => {
    expect(tagFill("#000000", "#ffffff", "light")).toBe(
      tagFill("oklch(0 0 0)", "oklch(1 0 0)", "light"),
    );
    // 16% of black in OKLab lightness is 0.84 on white; 24% is 0.76.
    expect(labOf(rgbOf(tagFill("#000000", "#ffffff", "light")))[0]).toBeCloseTo(
      0.84,
      2,
    );
    expect(labOf(rgbOf(tagFill("#000000", "#ffffff", "dark")))[0]).toBeCloseTo(
      0.76,
      2,
    );
  });
});

describe("tagBlend", () => {
  it("lands on a named colour's own hue", () => {
    expect(tagBlend(255, 0.2)).toEqual({
      from: "blue",
      to: "purple",
      toShare: 0,
      grayShare: 0,
    });
  });

  it("falls part of the way between two hue-adjacent colours", () => {
    expect(tagBlend(277.5, 0.2)).toEqual({
      from: "blue",
      to: "purple",
      toShare: 50,
      grayShare: 0,
    });
  });

  it("goes from pink to red across 0°", () => {
    expect(tagBlend(355, 0.2)).toMatchObject({
      from: "pink",
      to: "red",
      toShare: 14,
    });
    expect(tagBlend(5, 0.2)).toMatchObject({
      from: "pink",
      to: "red",
      toShare: 43,
    });
  });

  it("leans a weak colour toward gray, and takes a neutral one as gray", () => {
    expect(tagBlend(150, 0.05)).toMatchObject({ grayShare: 50 });
    expect(tagBlend(150, 0.005)).toBe("gray");
  });
});

describe("mixOklch", () => {
  it("turns the hue the shorter way round", () => {
    const at = (hue: number) =>
      oklab(`oklch(0.6 0.1 ${hue})`) as [number, number, number];
    const [, , hue] = lchOf(mixOklch(at(350), at(25), 0.5));
    expect(hue).toBeCloseTo(7.5, 6);
  });
});
