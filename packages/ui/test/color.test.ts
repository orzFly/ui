import {
  builtinThemes,
  resolvePalette,
  schemesOf,
  variantsOf,
} from "@orz/themes";
import { describe, expect, it } from "vitest";
import {
  type ColorFormat,
  contrastRatio,
  formatColor,
  gamutOf,
  mapToSrgb,
  type Oklch,
  parseColor,
} from "../src/lib/color.ts";

function parsed(text: string): Oklch {
  const result = parseColor(text);
  if (result === null) throw new Error(`does not parse: ${text}`);
  return result.color;
}

function expectClose(actual: Oklch, expected: Oklch) {
  expect(actual.l).toBeCloseTo(expected.l, 3);
  expect(actual.c).toBeCloseTo(expected.c, 3);
  expect(actual.h).toBeCloseTo(expected.h, 3);
  expect(actual.alpha).toBeCloseTo(expected.alpha, 3);
}

describe("parseColor and formatColor on the shipped tokens", () => {
  // Every palette under every variant, resolved, so variant overrides and
  // the computed AMOLED surfaces are covered alongside the base palettes.
  const values = builtinThemes.flatMap((theme) =>
    schemesOf(theme).flatMap((scheme) =>
      variantsOf(theme).flatMap(({ id }) => {
        // biome-ignore lint/style/noNonNullAssertion: schemesOf lists only present sides
        const { tokens, terminal } = resolvePalette(theme, scheme, id)!;
        return [...Object.values(tokens), ...Object.values(terminal)];
      }),
    ),
  );
  const unique = [...new Set(values)];

  it("finds the tokens", () => {
    expect(unique.length).toBeGreaterThan(50);
    expect(unique).toContain("oklch(1 0 0 / 10%)");
    expect(unique.some((value) => value.startsWith("#"))).toBe(true);
  });

  it.each(unique)("%s round-trips", (value) => {
    const result = parseColor(value);
    expect(result).not.toBeNull();
    const { color, format } = result as NonNullable<typeof result>;
    expect(format).not.toBeNull();
    expect(formatColor(color, format as ColorFormat)).toBe(value);
  });
});

describe("parseColor", () => {
  it.each([
    ["oklch(0.6 0.1 250)", { l: 0.6, c: 0.1, h: 250, alpha: 1 }, "oklch"],
    [
      "OKLCH(0.6 0.1 250 / 50%)",
      { l: 0.6, c: 0.1, h: 250, alpha: 0.5 },
      "oklch",
    ],
    ["#ff0000", { l: 0.628, c: 0.2577, h: 29.234, alpha: 1 }, "hex"],
    ["#f00", { l: 0.628, c: 0.2577, h: 29.234, alpha: 1 }, "hex"],
    ["#ff000080", { l: 0.628, c: 0.2577, h: 29.234, alpha: 0.502 }, "hex"],
    ["rgb(255 0 0)", { l: 0.628, c: 0.2577, h: 29.234, alpha: 1 }, "rgb"],
    [
      "rgba(255, 0, 0, 0.5)",
      { l: 0.628, c: 0.2577, h: 29.234, alpha: 0.5 },
      "rgb",
    ],
    ["hsl(0 100% 50%)", { l: 0.628, c: 0.2577, h: 29.234, alpha: 1 }, "hsl"],
    [
      "hsla(0, 100%, 50%, 0.25)",
      { l: 0.628, c: 0.2577, h: 29.234, alpha: 0.25 },
      "hsl",
    ],
    ["  red  ", { l: 0.628, c: 0.2577, h: 29.234, alpha: 1 }, null],
    [
      "color(display-p3 1 0 0)",
      { l: 0.6486, c: 0.2995, h: 28.958, alpha: 1 },
      null,
    ],
    ["white", { l: 1, c: 0, h: 0, alpha: 1 }, null],
  ] as const)("%s", (text, color, format) => {
    const result = parseColor(text);
    expect(result?.format).toBe(format);
    expectClose((result as NonNullable<typeof result>).color, color);
  });

  it("clamps rgb() and hsl() channels as CSS does", () => {
    for (const text of [
      "rgb(300 0 0)",
      "rgb(255 -20 -20)",
      "hsl(0 150% 50%)",
    ]) {
      expect(gamutOf(parsed(text))).toBe("srgb");
      expect(formatColor(parsed(text), "rgb")).toBe("rgb(255 0 0)");
    }
    expect(formatColor(parsed("hsl(0 100% 120%)"), "hex")).toBe("#ffffff");
  });

  it("gives an achromatic colour hue 0", () => {
    expect(parsed("oklch(0.5 0 0)").h).toBe(0);
    expect(parsed("#808080").h).toBe(0);
  });

  it.each(["", "   ", "nope", "rgb(", "var(--primary)"])(
    "rejects %j",
    (text) => {
      expect(parseColor(text)).toBeNull();
    },
  );
});

describe("formatColor", () => {
  it("rounds oklch to 3 decimals and drops trailing zeros", () => {
    expect(
      formatColor({ l: 0.62345, c: 0.21, h: 259.8156, alpha: 1 }, "oklch"),
    ).toBe("oklch(0.623 0.21 259.816)");
    expect(formatColor({ l: 0.5, c: 0, h: 0, alpha: 1 }, "oklch")).toBe(
      "oklch(0.5 0 0)",
    );
    expect(
      formatColor({ l: 0.5, c: 0.1, h: 359.9999, alpha: 1 }, "oklch"),
    ).toBe("oklch(0.5 0.1 0)");
  });

  it("writes alpha below 1 in each syntax", () => {
    const color = { ...parsed("#22c55e"), alpha: 0.5 };
    expect(formatColor(color, "oklch")).toMatch(/^oklch\(.+ \/ 50%\)$/);
    expect(formatColor(color, "hex")).toBe("#22c55e80");
    expect(formatColor(color, "rgb")).toBe("rgb(34 197 94 / 50%)");
    expect(formatColor(color, "hsl")).toMatch(/^hsl\(.+ \/ 50%\)$/);
    expect(formatColor({ ...color, alpha: 0.1234 }, "rgb")).toBe(
      "rgb(34 197 94 / 12.3%)",
    );
  });

  it("omits alpha that rounds to 1, and with alpha: false", () => {
    const color = { ...parsed("#22c55e"), alpha: 0.9999 };
    expect(formatColor(color, "rgb")).toBe("rgb(34 197 94)");
    const half = { ...color, alpha: 0.5 };
    for (const format of ["oklch", "hex", "rgb", "hsl"] as const)
      expect(formatColor(half, format, { alpha: false })).not.toMatch(
        /\/|#[0-9a-f]{8}/,
      );
    expect(formatColor(half, "hex", { alpha: false })).toBe("#22c55e");
  });

  it("writes modern rgb, hsl and lowercase hex", () => {
    const color = parsed("hsl(330 81% 60%)");
    expect(formatColor(color, "hsl")).toBe("hsl(330 81% 60%)");
    expect(formatColor(color, "rgb")).toBe("rgb(236 70 153)");
    expect(formatColor(color, "hex")).toBe("#ec4699");
    expect(formatColor(parsed("white"), "hsl")).toBe("hsl(0 0% 100%)");
  });

  it("maps a colour outside sRGB before writing hex, rgb or hsl", () => {
    const wide = parsed("oklch(0.7 0.37 145)");
    for (const format of ["hex", "rgb", "hsl"] as const)
      expect(formatColor(wide, format)).toBe(
        formatColor(mapToSrgb(wide), format),
      );
    expect(formatColor(wide, "oklch")).toBe("oklch(0.7 0.37 145)");
  });
});

describe("gamutOf and mapToSrgb", () => {
  const srgb = parsed("oklch(0.6 0.1 250)");
  const p3 = parsed("oklch(0.577 0.245 27.325)");
  const out = parsed("oklch(0.7 0.37 145)");

  it("classifies", () => {
    expect(gamutOf(srgb)).toBe("srgb");
    expect(gamutOf(p3)).toBe("p3");
    expect(gamutOf(out)).toBe("out");
    expect(gamutOf(parsed("#ffffff"))).toBe("srgb");
    expect(gamutOf(parsed("#000000"))).toBe("srgb");
  });

  it("leaves an sRGB colour alone", () => {
    expect(mapToSrgb(srgb)).toEqual(srgb);
  });

  it.each([
    ["p3", p3],
    ["out", out],
    ["translucent", { ...out, alpha: 0.4 }],
  ])(
    "lands a %s colour in sRGB, keeping lightness, hue and alpha",
    (_, color) => {
      const mapped = mapToSrgb(color);
      expect(gamutOf(mapped)).toBe("srgb");
      expect(mapped.c).toBeLessThan(color.c);
      expect(Math.abs(mapped.l - color.l)).toBeLessThan(0.02);
      expect(Math.abs(mapped.h - color.h)).toBeLessThan(3);
      expect(mapped.alpha).toBe(color.alpha);
    },
  );
});

describe("contrastRatio", () => {
  const black = parsed("black");
  const white = parsed("white");

  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5);
    const blue = parsed("oklch(0.6 0.1 250)");
    expect(contrastRatio(blue, blue)).toBeCloseTo(1, 5);
  });

  it("composites a translucent foreground over the background", () => {
    expect(contrastRatio({ ...black, alpha: 0 }, white)).toBeCloseTo(1, 5);
    // 50% black over white is #808080 (0.5 in gamma-encoded sRGB), not the lighter grey a
    // linear-light mix would give.
    const grey = parsed("rgb(127.5 127.5 127.5)");
    expect(contrastRatio({ ...black, alpha: 0.5 }, white)).toBeCloseTo(
      contrastRatio(grey, white),
      5,
    );
  });

  it("ignores the background's alpha", () => {
    expect(contrastRatio(black, { ...white, alpha: 0.2 })).toBeCloseTo(21, 5);
  });
});
