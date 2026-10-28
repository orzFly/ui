import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  builtinThemes,
  proNord,
  resolvePalette,
  schemesOf,
  type TextMateTheme,
  variantsOf,
} from "../src/index.ts";
import { contrast, rgbOf } from "./color.ts";

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

describe("the Prohibitorum themes' code and terminal colours", () => {
  const HUES = ["red", "green", "yellow", "blue", "magenta", "cyan"] as const;
  const ROLES = [
    "keyword",
    "string",
    "constant",
    "function",
    "type",
    "property",
    "parameter",
  ] as const;
  const sides = prohibitorum.flatMap((theme) =>
    schemesOf(theme).flatMap((scheme) =>
      variantsOf(theme).map(({ id: variant }) => {
        // biome-ignore lint/style/noNonNullAssertion: schemesOf lists only present sides
        const resolved = resolvePalette(theme, scheme, variant)!;
        return {
          name: `${theme.id} ${scheme} ${variant}`,
          id: theme.id,
          scheme,
          ...resolved,
          syntax: resolved.syntax as TextMateTheme,
        };
      }),
    ),
  );
  const below = (rows: [string, string, string][], floor: number) =>
    rows
      .map(([name, fg, bg]) => ({
        name,
        ratio: contrast(rgbOf(fg), rgbOf(bg)),
      }))
      .filter((r) => r.ratio < floor)
      .map((r) => `${r.name} ${r.ratio.toFixed(2)}:1`);

  it("gives every side a syntax theme of its own, named for the theme and side", () => {
    for (const { name, id, scheme, syntax } of sides) {
      expect(typeof syntax, name).toBe("object");
      expect(syntax.name, name).toBe(`orz-${id}-${scheme}`);
      expect(syntax.type, name).toBe(scheme);
    }
  });

  it("draws every syntax colour at 4.5:1 on the page", () => {
    const rows = sides.flatMap(({ name, syntax, tokens }) =>
      syntax.tokenColors.map((rule): [string, string, string] => [
        `${name} ${rule.scope[0]}`,
        rule.settings.foreground,
        tokens.background,
      ]),
    );
    expect(below(rows, 4.5)).toEqual([]);
  });

  it("draws normal ANSI colours at 4.5:1 and bright ones at 3:1 on the terminal", () => {
    const rows = (bright: boolean) =>
      sides.flatMap(({ name, terminal }) =>
        HUES.map((hue): [string, string, string] => {
          const token = bright ? `ansi-bright-${hue}` : `ansi-${hue}`;
          return [
            `${name} ${token}`,
            terminal[token as keyof typeof terminal],
            terminal["terminal-background"],
          ];
        }),
      );
    expect(below(rows(false), 4.5)).toEqual([]);
    expect(below(rows(true), 3)).toEqual([]);
  });

  it("keeps a side's seven syntax roles apart", () => {
    for (const { name, syntax } of sides) {
      const colours = syntax.tokenColors
        .slice(0, ROLES.length)
        .map((rule) => rule.settings.foreground);
      expect(new Set(colours).size, name).toBe(ROLES.length);
    }
  });

  it("paints the colours of the approved mockup", () => {
    // palettes.json from the mockup the colours were approved in, as is.
    const approved = JSON.parse(
      readFileSync(
        join(import.meta.dirname, "fixtures/pro-colours.json"),
        "utf8",
      ),
    );
    for (const {
      name,
      id,
      scheme,
      variant,
      syntax,
      tokens,
      terminal,
    } of sides) {
      if (variant !== "default") continue;
      const want = approved[id.slice("pro-".length)][scheme];
      const colourOf = (scope: string) =>
        syntax.tokenColors.find((rule) => rule.scope[0] === scope)?.settings
          .foreground;
      expect(
        {
          keyword: colourOf("keyword"),
          string: colourOf("string"),
          constant: colourOf("constant.numeric"),
          function: colourOf("entity.name.function"),
          type: colourOf("entity.name.type"),
          property: colourOf("variable.other.property"),
          parameter: colourOf("variable.parameter"),
          comment: colourOf("comment"),
          punctuation: colourOf("punctuation"),
        },
        name,
      ).toEqual(want.syntax);
      expect(
        Object.fromEntries(
          Object.entries(terminal)
            .filter(([token]) => token.startsWith("ansi-"))
            .map(([token, value]) => [token.slice("ansi-".length), value]),
        ),
        name,
      ).toEqual(want.ansi);
      expect(tokens.background, name).toBe(want.page.bg);
    }
  });
});
