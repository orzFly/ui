import { amoled } from "../amoled.ts";
import { grayOf, oklchOf } from "../color.ts";
import type { Palette, TerminalTokens, Theme, Tokens } from "../types.ts";

/*
 * Catppuccin as published, with no value adjusted: the owner chose the
 * official palette over contrast tuning, so a few pairs sit below AA and
 * test/palettes.ts lists them. Roles follow Catppuccin's style guide: Base
 * for the page, Mantle for the sidebar, Surface 0 for fills and borders,
 * Overlay 0 for a field's edge (the guide's inactive border), Text, Subtext 1
 * and Subtext 0 for text, Base on the Mauve primary, Lavender for the focus
 * ring (the guide's active border), and Red, Yellow and Green for status.
 *
 * Catppuccin has one light flavour and three dark ones, so light is always
 * Latte and the variants pick the dark flavour. A Gray variant turns every
 * background and text colour (Text through Crust) into the neutral grey of
 * the same OKLab lightness, on both sides; accents and status colours stay.
 */

type ColorName =
  | "rosewater"
  | "flamingo"
  | "pink"
  | "mauve"
  | "red"
  | "maroon"
  | "peach"
  | "yellow"
  | "green"
  | "teal"
  | "sky"
  | "sapphire"
  | "blue"
  | "lavender"
  | "text"
  | "subtext1"
  | "subtext0"
  | "overlay2"
  | "overlay1"
  | "overlay0"
  | "surface2"
  | "surface1"
  | "surface0"
  | "base"
  | "mantle"
  | "crust";
type AnsiName =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white";
type Flavor = Record<ColorName, string> & {
  /** Normal, then bright. */
  ansi: Record<AnsiName, [string, string]>;
};

// catppuccin/palette 1.8.0, https://raw.githubusercontent.com/catppuccin/palette/v1.8.0/palette.json
const latte: Flavor = {
  rosewater: "#dc8a78",
  flamingo: "#dd7878",
  pink: "#ea76cb",
  mauve: "#8839ef",
  red: "#d20f39",
  maroon: "#e64553",
  peach: "#fe640b",
  yellow: "#df8e1d",
  green: "#40a02b",
  teal: "#179299",
  sky: "#04a5e5",
  sapphire: "#209fb5",
  blue: "#1e66f5",
  lavender: "#7287fd",
  text: "#4c4f69",
  subtext1: "#5c5f77",
  subtext0: "#6c6f85",
  overlay2: "#7c7f93",
  overlay1: "#8c8fa1",
  overlay0: "#9ca0b0",
  surface2: "#acb0be",
  surface1: "#bcc0cc",
  surface0: "#ccd0da",
  base: "#eff1f5",
  mantle: "#e6e9ef",
  crust: "#dce0e8",
  ansi: {
    black: ["#5c5f77", "#6c6f85"],
    red: ["#d20f39", "#de293e"],
    green: ["#40a02b", "#49af3d"],
    yellow: ["#df8e1d", "#eea02d"],
    blue: ["#1e66f5", "#456eff"],
    magenta: ["#ea76cb", "#fe85d8"],
    cyan: ["#179299", "#2d9fa8"],
    white: ["#acb0be", "#bcc0cc"],
  },
};
const frappe: Flavor = {
  rosewater: "#f2d5cf",
  flamingo: "#eebebe",
  pink: "#f4b8e4",
  mauve: "#ca9ee6",
  red: "#e78284",
  maroon: "#ea999c",
  peach: "#ef9f76",
  yellow: "#e5c890",
  green: "#a6d189",
  teal: "#81c8be",
  sky: "#99d1db",
  sapphire: "#85c1dc",
  blue: "#8caaee",
  lavender: "#babbf1",
  text: "#c6d0f5",
  subtext1: "#b5bfe2",
  subtext0: "#a5adce",
  overlay2: "#949cbb",
  overlay1: "#838ba7",
  overlay0: "#737994",
  surface2: "#626880",
  surface1: "#51576d",
  surface0: "#414559",
  base: "#303446",
  mantle: "#292c3c",
  crust: "#232634",
  ansi: {
    black: ["#51576d", "#626880"],
    red: ["#e78284", "#e67172"],
    green: ["#a6d189", "#8ec772"],
    yellow: ["#e5c890", "#d9ba73"],
    blue: ["#8caaee", "#7b9ef0"],
    magenta: ["#f4b8e4", "#f2a4db"],
    cyan: ["#81c8be", "#5abfb5"],
    white: ["#a5adce", "#b5bfe2"],
  },
};
const macchiato: Flavor = {
  rosewater: "#f4dbd6",
  flamingo: "#f0c6c6",
  pink: "#f5bde6",
  mauve: "#c6a0f6",
  red: "#ed8796",
  maroon: "#ee99a0",
  peach: "#f5a97f",
  yellow: "#eed49f",
  green: "#a6da95",
  teal: "#8bd5ca",
  sky: "#91d7e3",
  sapphire: "#7dc4e4",
  blue: "#8aadf4",
  lavender: "#b7bdf8",
  text: "#cad3f5",
  subtext1: "#b8c0e0",
  subtext0: "#a5adcb",
  overlay2: "#939ab7",
  overlay1: "#8087a2",
  overlay0: "#6e738d",
  surface2: "#5b6078",
  surface1: "#494d64",
  surface0: "#363a4f",
  base: "#24273a",
  mantle: "#1e2030",
  crust: "#181926",
  ansi: {
    black: ["#494d64", "#5b6078"],
    red: ["#ed8796", "#ec7486"],
    green: ["#a6da95", "#8ccf7f"],
    yellow: ["#eed49f", "#e1c682"],
    blue: ["#8aadf4", "#78a1f6"],
    magenta: ["#f5bde6", "#f2a9dd"],
    cyan: ["#8bd5ca", "#63cbc0"],
    white: ["#a5adcb", "#b8c0e0"],
  },
};
const mocha: Flavor = {
  rosewater: "#f5e0dc",
  flamingo: "#f2cdcd",
  pink: "#f5c2e7",
  mauve: "#cba6f7",
  red: "#f38ba8",
  maroon: "#eba0ac",
  peach: "#fab387",
  yellow: "#f9e2af",
  green: "#a6e3a1",
  teal: "#94e2d5",
  sky: "#89dceb",
  sapphire: "#74c7ec",
  blue: "#89b4fa",
  lavender: "#b4befe",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",
  overlay2: "#9399b2",
  overlay1: "#7f849c",
  overlay0: "#6c7086",
  surface2: "#585b70",
  surface1: "#45475a",
  surface0: "#313244",
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
  ansi: {
    black: ["#45475a", "#585b70"],
    red: ["#f38ba8", "#f37799"],
    green: ["#a6e3a1", "#89d88b"],
    yellow: ["#f9e2af", "#ebd391"],
    blue: ["#89b4fa", "#74a8fc"],
    magenta: ["#f5c2e7", "#f2aede"],
    cyan: ["#94e2d5", "#6bd7ca"],
    white: ["#a6adc8", "#bac2de"],
  },
};

const NEUTRALS: ReadonlySet<ColorName> = new Set([
  "text",
  "subtext1",
  "subtext0",
  "overlay2",
  "overlay1",
  "overlay0",
  "surface2",
  "surface1",
  "surface0",
  "base",
  "mantle",
  "crust",
]);

function paletteOf(
  flavor: Flavor,
  label: string,
  syntax: string,
  gray: boolean,
): Palette {
  const neutral = (name: ColorName) => gray && NEUTRALS.has(name);
  const color = (name: ColorName) =>
    neutral(name) ? grayOf(flavor[name]) : flavor[name];
  // ANSI black and white are neutrals too (Surface and Subtext shades), but
  // palette.json gives them as plain hex.
  const ansi = (name: AnsiName, bright: 0 | 1) => {
    const value = flavor.ansi[name][bright];
    return gray && (name === "black" || name === "white")
      ? grayOf(value)
      : value;
  };
  const tokens: Tokens = {
    "diff-addition": color("green"),
    "diff-deletion": color("red"),
    background: color("base"),
    foreground: color("text"),
    card: color("base"),
    "card-foreground": color("text"),
    popover: color("base"),
    "popover-foreground": color("text"),
    primary: color("mauve"),
    "primary-foreground": color("base"),
    secondary: color("surface0"),
    "secondary-foreground": color("text"),
    muted: color("surface0"),
    "muted-foreground": color("subtext0"),
    accent: color("surface0"),
    "accent-foreground": color("text"),
    destructive: color("red"),
    success: color("green"),
    warning: color("yellow"),
    border: color("surface0"),
    input: color("overlay0"),
    ring: color("lavender"),
    "chart-1": color("mauve"),
    "chart-2": color("green"),
    "chart-3": color("yellow"),
    "chart-4": color("red"),
    "chart-5": color("blue"),
    sidebar: color("mantle"),
    "sidebar-foreground": color("subtext1"),
    "sidebar-primary": color("mauve"),
    "sidebar-primary-foreground": color("base"),
    "sidebar-accent": color("surface0"),
    "sidebar-accent-foreground": color("text"),
    "sidebar-border": color("surface0"),
    "sidebar-ring": color("lavender"),
  };
  // Cursor Rosewater and selection Overlay 2 at 30%, per
  // https://github.com/catppuccin/catppuccin/blob/main/docs/style-guide.md
  const terminal: TerminalTokens = {
    "terminal-background": color("base"),
    "terminal-foreground": color("text"),
    "terminal-cursor": color("rosewater"),
    "terminal-selection": `${color("overlay2")}4d`,
    "ansi-black": ansi("black", 0),
    "ansi-red": ansi("red", 0),
    "ansi-green": ansi("green", 0),
    "ansi-yellow": ansi("yellow", 0),
    "ansi-blue": ansi("blue", 0),
    "ansi-magenta": ansi("magenta", 0),
    "ansi-cyan": ansi("cyan", 0),
    "ansi-white": ansi("white", 0),
    "ansi-bright-black": ansi("black", 1),
    "ansi-bright-red": ansi("red", 1),
    "ansi-bright-green": ansi("green", 1),
    "ansi-bright-yellow": ansi("yellow", 1),
    "ansi-bright-blue": ansi("blue", 1),
    "ansi-bright-magenta": ansi("magenta", 1),
    "ansi-bright-cyan": ansi("cyan", 1),
    "ansi-bright-white": ansi("white", 1),
  };
  return { label, tokens, terminal, syntax };
}

const lightPalette = paletteOf(latte, "Latte", "catppuccin-latte", false);
const lightGray = paletteOf(latte, "Latte", "catppuccin-latte", true);
const darkPalette = paletteOf(mocha, "Mocha", "catppuccin-mocha", false);

const DARK = [
  ["mocha", "Mocha", mocha],
  ["frappe", "Frappé", frappe],
  ["macchiato", "Macchiato", macchiato],
] as const;

/** A palette as a variant that replaces every token of the side it sits on. */
const whole = (label: string, { tokens, terminal, syntax }: Palette) => ({
  label,
  tokens,
  terminal,
  syntax,
});

const lightVariants: NonNullable<Palette["variants"]> = {};
const darkVariants: NonNullable<Palette["variants"]> = {};
for (const [id, name, flavor] of DARK) {
  if (id === "mocha") continue;
  darkVariants[id] = whole(
    name,
    paletteOf(flavor, name, `catppuccin-${id}`, false),
  );
}
for (const [id, name, flavor] of DARK) {
  const label = `${name} (Gray)`;
  lightVariants[`${id}-gray`] = whole(label, lightGray);
  darkVariants[`${id}-gray`] = whole(
    label,
    paletteOf(flavor, name, `catppuccin-${id}`, true),
  );
}
// amoled() derives from oklch() values only.
const mochaOklch = {
  ...darkPalette,
  tokens: Object.fromEntries(
    Object.entries(darkPalette.tokens).map(([name, value]) => [
      name,
      oklchOf(value),
    ]),
  ) as Tokens,
};
// Mantle sits below Base, so AMOLED takes the sidebar to black with the page;
// the sidebar's highlight and border keep their contrast with Mantle instead.
const black = amoled(mochaOklch);
const onSidebar = amoled({
  ...mochaOklch,
  tokens: { ...mochaOklch.tokens, background: mochaOklch.tokens.sidebar },
}).tokens;
darkVariants.amoled = {
  ...black,
  tokens: {
    ...black.tokens,
    "sidebar-accent": onSidebar?.["sidebar-accent"],
    "sidebar-border": onSidebar?.["sidebar-border"],
  },
};

export const catppuccin: Theme = {
  id: "catppuccin",
  label: "Catppuccin",
  defaultVariantLabel: "Mocha",
  light: { ...lightPalette, variants: lightVariants },
  dark: { ...darkPalette, variants: darkVariants },
};
