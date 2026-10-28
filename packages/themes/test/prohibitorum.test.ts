import { describe, expect, it } from "vitest";
import { builtinThemes, proNord, resolvePalette } from "../src/index.ts";

// Prohibitorum's dashboard/src/lib/color-scheme.ts at 6d3bc42: each scheme's
// swatch, the page surface and the accent its pickers preview.
const SWATCHES = {
  graphite: [
    ["#ffffff", "#262626"],
    ["#121212", "#f5f5f5"],
  ],
  nord: [
    ["#eceff4", "#406593"],
    ["#292e39", "#88c0d0"],
  ],
  sand: [
    ["#fdfdfc", "#553c2b"],
    ["#111110", "#dfc1a6"],
  ],
  matcha: [
    ["#fdf6e3", "#5c6f21"],
    ["#272e33", "#a7c080"],
  ],
  sakura: [
    ["#fff8fb", "#c33278"],
    ["#1a1017", "#f7a0c0"],
  ],
  lavender: [
    ["#eff1f5", "#8839ef"],
    ["#1e1e2e", "#cba6f7"],
  ],
  lagoon: [
    ["#f3fcfb", "#117393"],
    ["#06161c", "#5ddae0"],
  ],
  citrus: [
    ["#fdfcf3", "#eae14a"],
    ["#15140e", "#e7ea6a"],
  ],
} as const;

const prohibitorum = builtinThemes.filter((t) => t.id.startsWith("pro-"));

describe("the Prohibitorum themes", () => {
  it("lists the eight schemes in Prohibitorum's order, as Pro<Name>", () => {
    expect(prohibitorum.map((t) => [t.id, t.label])).toEqual(
      Object.keys(SWATCHES).map((slug) => [
        `pro-${slug}`,
        `Pro${slug[0].toUpperCase()}${slug.slice(1)}`,
      ]),
    );
  });

  it("paints each scheme's page and primary as its swatch shows them", () => {
    for (const [slug, [light, dark]] of Object.entries(SWATCHES)) {
      // biome-ignore lint/style/noNonNullAssertion: the order test covers the list
      const theme = prohibitorum.find((t) => t.id === `pro-${slug}`)!;
      for (const [scheme, [surface, accent]] of [
        ["light", light],
        ["dark", dark],
      ] as const) {
        const tokens = resolvePalette(theme, scheme)?.tokens;
        expect(tokens?.primary, `${slug} ${scheme}`).toBe(accent);
        // Graphite's dark swatch approximates its page, neutral-950 mixed 4%
        // toward white, which paints #141414.
        if (slug === "graphite" && scheme === "dark") continue;
        expect(tokens?.background, `${slug} ${scheme}`).toBe(surface);
      }
    }
  });

  it("writes status text in Prohibitorum's *-foreground colours, a scheme's own included", () => {
    const light = resolvePalette(proNord, "light")?.tokens;
    // red-700, emerald-700, and Nord's own amber-800 for warning text.
    expect([light?.destructive, light?.success, light?.warning]).toEqual([
      "#c10007",
      "#007a55",
      "#973c00",
    ]);
    // Nord dark's own red-300 for error text.
    expect(resolvePalette(proNord, "dark")?.tokens.destructive).toBe("#ffa2a2");
  });

  it("raises the field edge off the border, which Prohibitorum draws it with", () => {
    for (const theme of prohibitorum) {
      for (const scheme of ["light", "dark"] as const) {
        const tokens = resolvePalette(theme, scheme)?.tokens;
        expect(tokens?.input, `${theme.id} ${scheme}`).not.toBe(tokens?.border);
      }
    }
  });
});
