import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  builtinThemes,
  resolvePalette,
  schemesOf,
  variantsOf,
} from "@orz/themes";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  readFileSync(join(import.meta.dirname, "../src/components", file), "utf8");
const BUTTON = source("button.tsx");
const MENU = source("dropdown-menu.tsx");
const BADGE = source("badge.tsx");

/** WCAG AA for normal-size text, which every button, badge and menu label is. */
const AA = 4.5;
/** WCAG 1.4.11's floor for a graphical object such as a menu item's icon. */
const NON_TEXT = 3;

type Rgb = [number, number, number];
type Lab = [number, number, number];

// Every palette under every variant its theme offers; a variant a side lacks
// resolves to that side's default, which is what the page shows then. One
// that paints a side exactly as an earlier one does is listed once, under the
// earlier name.
const PALETTES = builtinThemes.flatMap((theme) =>
  schemesOf(theme).flatMap((scheme) => {
    const seen = new Set<string>();
    return variantsOf(theme).flatMap(({ id }) => {
      // biome-ignore lint/style/noNonNullAssertion: schemesOf lists only present sides
      const { tokens } = resolvePalette(theme, scheme, id)!;
      const key = JSON.stringify(tokens);
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ name: `${theme.id} ${scheme} ${id}`, scheme, tokens }];
    });
  }),
);

/** sRGB `#rrggbb` through CSS Color 4's matrices; Catppuccin's tokens are hex. */
function hexOklab(hex: string): Lab {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const long = Math.cbrt(
    0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
  );
  const medium = Math.cbrt(
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
  );
  const short = Math.cbrt(
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  );
  return [
    0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
    0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short,
  ];
}

function oklab(spec: string): Lab {
  if (/^#[0-9a-f]{6}$/i.test(spec)) return hexOklab(spec);
  const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(spec);
  if (!m) throw new Error(`not a plain oklch() or hex colour: ${spec}`);
  const hue = (Number(m[3]) * Math.PI) / 180;
  return [
    Number(m[1]),
    Number(m[2]) * Math.cos(hue),
    Number(m[2]) * Math.sin(hue),
  ];
}

/** CSS Color 4's Oklab matrices, then the sRGB transfer function. */
function srgb([lightness, a, b]: Lab): Rgb {
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const encode = (v: number) => {
    const e = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(e * 255)));
  };
  return [
    encode(4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short),
    encode(-1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short),
    encode(-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short),
  ];
}

/** `color-mix(in oklab, x, y t)`. */
const mix = (x: Lab, y: Lab, t: number): Lab =>
  x.map((v, i) => v * (1 - t) + y[i] * t) as Lab;

/** A `/NN` tint, which the browser composites in sRGB. */
const over = (fg: Rgb, bg: Rgb, alpha: number): Rgb =>
  fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as Rgb;

/** WCAG 2.x relative luminance and the (L1+0.05)/(L2+0.05) ratio. */
function contrast(x: Rgb, y: Rgb): number {
  const luminance = (c: Rgb) => {
    const [r, g, b] = c.map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(x);
  const b = luminance(y);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Read off the class rather than transcribed, so retuning it without
// re-measuring fails here instead of passing on a stale number.
const MIX_CLASS =
  /text-\[color-mix\(in_oklab,var\(--destructive\),var\(--foreground\)_(\d+)%\)\]/;
const MIX = MIX_CLASS.exec(BUTTON);

/**
 * Rows kept below a floor on purpose, by test and row name, each holding the
 * lowest ratio it may fall to: the palette's own, rounded down, so a change
 * that makes one worse still fails. Catppuccin paints its published colours
 * unadjusted (@orz/themes' src/themes/catppuccin.ts). On its light side
 * "default" is Latte and "mocha-gray" is Latte Gray.
 */
const EXEMPT: Record<string, Record<string, number>> = {
  button: {
    "catppuccin light default@0.2": 4.36,
    "catppuccin light mocha-gray@0.2": 4.38,
    "catppuccin dark frappe@0.3": 4.18,
    "catppuccin dark frappe-gray@0.3": 4.13,
  },
  "badge success": {
    "catppuccin light default@0.2": 4.21,
    "catppuccin light mocha-gray@0.2": 4.19,
    "catppuccin dark frappe@0.3": 3.97,
    "catppuccin dark frappe-gray@0.3": 3.92,
  },
  "badge warning": {
    "catppuccin light default@0.1": 4.27,
    "catppuccin light default@0.2": 3.94,
    "catppuccin light mocha-gray@0.1": 4.3,
    "catppuccin light mocha-gray@0.2": 3.95,
    "catppuccin dark frappe@0.3": 3.97,
    "catppuccin dark frappe-gray@0.3": 3.91,
  },
};

/** The rows under their floor, and every exemption that no longer names a row under `floor`. */
function failures(
  test: string,
  rows: { name: string; ratio: number }[],
  floor: number,
): string[] {
  const exempt = EXEMPT[test] ?? {};
  const below = rows
    .filter((r) => r.ratio < (exempt[r.name] ?? floor))
    .map((r) => `${r.name} ${r.ratio.toFixed(2)}:1`);
  const stale = Object.keys(exempt)
    .filter((name) => !rows.some((r) => r.name === name && r.ratio < floor))
    .map((name) => `stale exemption: ${name}`);
  return [...below, ...stale];
}

describe("destructive variant contrast", () => {
  it("mixes --foreground into the label rather than using bare --destructive", () => {
    expect(MIX).not.toBeNull();
  });

  it("clears AA in every palette and variant, on its resting and hover tints", () => {
    const share = Number(MIX?.[1]) / 100;
    const rows = PALETTES.flatMap(({ name, scheme, tokens }) => {
      const destructive = oklab(tokens.destructive);
      const label = srgb(mix(destructive, oklab(tokens.foreground), share));
      const page = srgb(oklab(tokens.background));
      // bg-destructive/10 + hover /20; dark: /20 + hover /30.
      const tints = scheme === "dark" ? [0.2, 0.3] : [0.1, 0.2];
      return tints.map((alpha) => ({
        name: `${name}@${alpha}`,
        ratio: contrast(label, over(srgb(destructive), page, alpha)),
      }));
    });
    expect(failures("button", rows, AA)).toEqual([]);
  });
});

describe("destructive menu item contrast", () => {
  const share = (state: string) => {
    const m = new RegExp(
      `data-\\[variant=destructive\\]:${state}${MIX_CLASS.source}`,
    ).exec(MENU);
    return m ? Number(m[1]) / 100 : null;
  };
  const rest = share("");
  const focus = share("focus:");

  // Resting on the popover, and focused on bg-destructive/10 (dark: /20).
  const surfaces = (scheme: string, tokens: Record<string, string>) => {
    const popover = srgb(oklab(tokens.popover));
    const tint = scheme === "dark" ? 0.2 : 0.1;
    return [
      { state: "rest", bg: popover },
      {
        state: "focus",
        bg: over(srgb(oklab(tokens.destructive)), popover, tint),
      },
    ];
  };

  it("mixes --foreground into the label at rest and on focus", () => {
    expect({ rest, focus }).toEqual({
      rest: expect.any(Number),
      focus: expect.any(Number),
    });
  });

  it("clears AA in every palette and variant, at rest and on focus", () => {
    const rows = PALETTES.flatMap(({ name, scheme, tokens }) => {
      const destructive = oklab(tokens.destructive);
      const foreground = oklab(tokens.foreground);
      return surfaces(scheme, tokens).map(({ state, bg }) => ({
        name: `${name} ${state}`,
        ratio: contrast(
          srgb(
            mix(
              destructive,
              foreground,
              (state === "rest" ? rest : focus) ?? 0,
            ),
          ),
          bg,
        ),
      }));
    });
    expect(failures("menu", rows, AA)).toEqual([]);
  });

  it("keeps the icon's bare --destructive above 3:1", () => {
    expect(MENU).toContain(
      "data-[variant=destructive]:*:[svg]:text-destructive",
    );
    const rows = PALETTES.flatMap(({ name, scheme, tokens }) =>
      surfaces(scheme, tokens).map(({ state, bg }) => ({
        name: `${name} ${state}`,
        ratio: contrast(srgb(oklab(tokens.destructive)), bg),
      })),
    );
    expect(failures("menu icon", rows, NON_TEXT)).toEqual([]);
  });
});

// Badge's success and warning variants copy the destructive recipe on their
// own tokens, so each is measured on its own.
describe.each(["success", "warning"] as const)(
  "badge %s variant contrast",
  (status) => {
    const mixed = new RegExp(
      `text-\\[color-mix\\(in_oklab,var\\(--${status}\\),var\\(--foreground\\)_(\\d+)%\\)\\]`,
    ).exec(BADGE);

    it("mixes --foreground into the label", () => {
      expect(mixed).not.toBeNull();
    });

    it("clears AA in every palette and variant, on its resting and hover tints", () => {
      const share = Number(mixed?.[1]) / 100;
      const rows = PALETTES.flatMap(({ name, scheme, tokens }) => {
        const colour = oklab(tokens[status]);
        const label = srgb(mix(colour, oklab(tokens.foreground), share));
        const page = srgb(oklab(tokens.background));
        const tints = scheme === "dark" ? [0.2, 0.3] : [0.1, 0.2];
        return tints.map((alpha) => ({
          name: `${name}@${alpha}`,
          ratio: contrast(label, over(srgb(colour), page, alpha)),
        }));
      });
      expect(failures(`badge ${status}`, rows, AA)).toEqual([]);
    });
  },
);
