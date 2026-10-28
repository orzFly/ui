import {
  type ProSide,
  type Published,
  prohibitorumTheme,
} from "../prohibitorum.ts";
import type { Theme } from "../types.ts";

// Prohibitorum's Lavender scheme, resolved to hex; see src/prohibitorum.ts.
const light: Published = {
  background: "#eff1f5",
  foreground: "#4c4f69",
  card: "#ffffff",
  popover: "#ffffff",
  primary: "#8839ef",
  "primary-foreground": "#ffffff",
  muted: "#e6e9ef",
  "muted-foreground": "#5c5f77",
  accent: "#ece5fb",
  border: "#ccd0da",
  ring: "#8839ef",
  sidebar: "#e6e9ef",
  "sidebar-foreground": "#464960",
  "sidebar-accent": "#ece5fb",
  "sidebar-border": "#ccd0da",
  "sidebar-ring": "#8839ef",
  destructive: "#fb2c36",
  "destructive-foreground": "#c10007",
  success: "#00bc7d",
  "success-foreground": "#007a55",
  warning: "#fe9a00",
  "warning-foreground": "#973c00",
  info: "#2b7fff",
};

const dark: Published = {
  background: "#1e1e2e",
  foreground: "#cdd6f4",
  card: "#24243a",
  popover: "#24243a",
  primary: "#cba6f7",
  "primary-foreground": "#1e1e2e",
  muted: "#313244",
  "muted-foreground": "#a6adc8",
  accent: "#313244",
  border: "#45475a",
  ring: "#cba6f7",
  sidebar: "#181825",
  "sidebar-foreground": "#a6adc8",
  "sidebar-accent": "#313244",
  "sidebar-border": "#45475a",
  "sidebar-ring": "#cba6f7",
  destructive: "#fb414a",
  "destructive-foreground": "#ff6467",
  success: "#00bc7d",
  "success-foreground": "#00d492",
  warning: "#fe9a00",
  "warning-foreground": "#ffb900",
  info: "#2b7fff",
};

// Catppuccin Latte and Mocha's published accents, moved in lightness only
// where one misses its floor on this page.
const lightColours: ProSide = {
  syntax: {
    keyword: "#8839ef",
    string: "#1f7b00",
    constant: "#b84500",
    function: "#175fee",
    type: "#995d00",
    property: "#5060d2",
    parameter: "#cb283e",
  },
  ansi: {
    red: { normal: "#d20f39", bright: "#f74256" },
    green: { normal: "#207e00", bright: "#439d30" },
    yellow: { normal: "#9d6000", bright: "#bb7c2f" },
    blue: { normal: "#1b63f1", bright: "#4b87fd" },
    magenta: { normal: "#b24297", bright: "#d260b4" },
    cyan: { normal: "#007a80", bright: "#36989e" },
  },
};

const darkColours: ProSide = {
  syntax: {
    keyword: "#cba6f7",
    string: "#a6e3a1",
    constant: "#fab387",
    function: "#89b4fa",
    type: "#f9e2af",
    property: "#b4befe",
    parameter: "#eba0ac",
  },
  ansi: {
    red: { normal: "#f38ba8", bright: "#ffafc3" },
    green: { normal: "#a6e3a1", bright: "#c0feba" },
    yellow: { normal: "#f9e2af", bright: "#fff4dc" },
    blue: { normal: "#89b4fa", bright: "#b0ceff" },
    magenta: { normal: "#f5c2e7", bright: "#ffe6f8" },
    cyan: { normal: "#94e2d5", bright: "#aefdef" },
  },
};

export const proLavender: Theme = prohibitorumTheme(
  "pro-lavender",
  "ProLavender",
  light,
  dark,
  { light: lightColours, dark: darkColours },
);
