import { describe, expect, it } from "vitest";
import { autoTagColor, tagInk } from "../src/lib/tag-color.ts";

describe("autoTagColor", () => {
  // Pinned: the hash and the order of the colours are what every app's tags
  // are coloured by, so a change here recolours them all.
  it.each([
    ["bug", "blue"],
    ["ci", "orange"],
    ["docs", "yellow"],
    ["design", "pink"],
    ["perf", "purple"],
    ["release", "purple"],
  ])("colours %s %s", (key, color) => {
    expect(autoTagColor(key)).toBe(color);
  });

  it("never picks gray", () => {
    let seed = 1;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed;
    };
    for (let i = 0; i < 1000; i++) {
      const key = Array.from({ length: 1 + (random() % 12) }, () =>
        String.fromCharCode(32 + (random() % 0x2fff)),
      ).join("");
      expect(autoTagColor(key)).not.toBe("gray");
    }
  });
});

describe("tagInk", () => {
  it("draws a name in the theme's colour of that name", () => {
    expect(tagInk("red")).toBe("var(--tag-red)");
    expect(tagInk("gray")).toBe("var(--tag-gray)");
  });

  it("draws another colour between the two named colours its hue falls between", () => {
    // GitHub's bug red sits a little short of the red tag's hue.
    expect(tagInk("#d73a4a")).toBe(
      "color-mix(in oklch, var(--tag-pink), var(--tag-red) 86%)",
    );
  });

  it("draws a colour on a named colour's own hue as that colour", () => {
    expect(tagInk("oklch(0.6 0.15 255)")).toBe("var(--tag-blue)");
  });

  it("goes from pink to red across 0°", () => {
    expect(tagInk("oklch(0.6 0.15 5)")).toBe(
      "color-mix(in oklch, var(--tag-pink), var(--tag-red) 43%)",
    );
  });

  it("leans a weak colour toward gray", () => {
    expect(tagInk("oklch(0.6 0.05 148)")).toBe(
      "color-mix(in oklab, var(--tag-green), var(--tag-gray) 50%)",
    );
    expect(tagInk("#cfd3d7")).toBe("var(--tag-gray)");
    expect(tagInk("#a2eeef")).toMatch(
      /^color-mix\(in oklab, color-mix\(in oklch, var\(--tag-teal\), var\(--tag-blue\) \d+%\), var\(--tag-gray\) \d+%\)$/,
    );
  });

  it("takes white and black as gray", () => {
    expect(tagInk("#ffffff")).toBe("var(--tag-gray)");
    expect(tagInk("black")).toBe("var(--tag-gray)");
  });

  it("ignores alpha", () => {
    expect(tagInk("#d73a4a80")).toBe(tagInk("#d73a4a"));
  });

  it("is undefined for no colour or one that does not parse", () => {
    expect(tagInk(undefined)).toBeUndefined();
    expect(tagInk("var(--x)")).toBeUndefined();
    expect(tagInk("nope")).toBeUndefined();
  });
});
