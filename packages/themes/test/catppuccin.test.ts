import { describe, expect, it } from "vitest";
import { grayOf } from "../src/color.ts";
import { catppuccin, resolvePalette, variantsOf } from "../src/index.ts";

const tokens = (scheme: "light" | "dark", variant?: string) =>
  resolvePalette(catppuccin, scheme, variant)?.tokens;

describe("catppuccin", () => {
  it("offers the three dark flavours, each again in grey, then AMOLED", () => {
    expect(variantsOf(catppuccin)).toEqual([
      { id: "default", label: "Mocha" },
      { id: "frappe", label: "Frappé" },
      { id: "macchiato", label: "Macchiato" },
      { id: "mocha-gray", label: "Mocha (Gray)" },
      { id: "frappe-gray", label: "Frappé (Gray)" },
      { id: "macchiato-gray", label: "Macchiato (Gray)" },
      { id: "amoled", label: "AMOLED" },
    ]);
  });

  it("paints the published colours", () => {
    // Base, Mantle, Text and Mauve, from palette.json.
    const pick = (t: ReturnType<typeof tokens>) => [
      t?.background,
      t?.sidebar,
      t?.foreground,
      t?.primary,
    ];
    expect(pick(tokens("light"))).toEqual([
      "#eff1f5",
      "#e6e9ef",
      "#4c4f69",
      "#8839ef",
    ]);
    expect(pick(tokens("dark"))).toEqual([
      "#1e1e2e",
      "#181825",
      "#cdd6f4",
      "#cba6f7",
    ]);
    expect(pick(tokens("dark", "frappe"))).toEqual([
      "#303446",
      "#292c3c",
      "#c6d0f5",
      "#ca9ee6",
    ]);
    expect(pick(tokens("dark", "macchiato"))).toEqual([
      "#24273a",
      "#1e2030",
      "#cad3f5",
      "#c6a0f6",
    ]);
    expect(resolvePalette(catppuccin, "dark", "macchiato")?.syntax).toBe(
      "catppuccin-macchiato",
    );
  });

  it("keeps Latte on the light side, grey under every Gray variant", () => {
    for (const variant of ["frappe", "macchiato", "amoled"]) {
      expect(tokens("light", variant), variant).toEqual(tokens("light"));
    }
    for (const variant of ["mocha-gray", "frappe-gray", "macchiato-gray"]) {
      expect(tokens("light", variant), variant).toEqual(
        tokens("light", "mocha-gray"),
      );
    }
  });

  it("greys the background and text colours only", () => {
    for (const [scheme, variant, plain] of [
      ["light", "mocha-gray", "default"],
      ["dark", "mocha-gray", "default"],
      ["dark", "frappe-gray", "frappe"],
    ] as const) {
      const gray = resolvePalette(catppuccin, scheme, variant);
      const base = resolvePalette(catppuccin, scheme, plain);
      for (const name of [
        "background",
        "foreground",
        "muted-foreground",
        "sidebar",
        "input",
      ] as const) {
        expect(gray?.tokens[name], `${variant} ${name}`).toBe(
          grayOf(base?.tokens[name] ?? ""),
        );
      }
      for (const name of [
        "primary",
        "destructive",
        "ring",
        "chart-5",
      ] as const) {
        expect(gray?.tokens[name], name).toBe(base?.tokens[name]);
      }
      expect(gray?.terminal["ansi-red"]).toBe(base?.terminal["ansi-red"]);
      expect(gray?.terminal["ansi-black"]).toBe(
        grayOf(base?.terminal["ansi-black"] ?? ""),
      );
    }
  });
});
