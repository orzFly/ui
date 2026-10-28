import {
  type ProSide,
  type Published,
  prohibitorumTheme,
} from "../prohibitorum.ts";
import type { Theme } from "../types.ts";

// Prohibitorum's Graphite scheme, resolved to hex; see src/prohibitorum.ts.
const light: Published = {
  background: "#ffffff",
  foreground: "#262626",
  card: "#ffffff",
  popover: "#ffffff",
  primary: "#262626",
  "primary-foreground": "#fafafa",
  muted: "#f5f5f5",
  "muted-foreground": "#686868",
  accent: "#f5f5f5",
  border: "#ebebeb",
  ring: "#737373",
  sidebar: "#fafafa",
  "sidebar-foreground": "#484848",
  "sidebar-accent": "#f0f0f0",
  "sidebar-border": "#ebebeb",
  "sidebar-ring": "#a1a1a1",
  destructive: "#fb2c36",
  "destructive-foreground": "#c10007",
  success: "#00bc7d",
  "success-foreground": "#007a55",
  warning: "#fe9a00",
  "warning-foreground": "#bb4d00",
  info: "#2b7fff",
};

const dark: Published = {
  background: "#141414",
  foreground: "#f5f5f5",
  card: "#191919",
  popover: "#1d1d1d",
  primary: "#f5f5f5",
  "primary-foreground": "#262626",
  muted: "#1d1d1d",
  "muted-foreground": "#8f8f8f",
  accent: "#1d1d1d",
  border: "#222222",
  ring: "#737373",
  sidebar: "#111111",
  "sidebar-foreground": "#d1d1d1",
  "sidebar-accent": "#1b1b1b",
  "sidebar-border": "#1d1d1d",
  "sidebar-ring": "#a1a1a1",
  destructive: "#fb414a",
  "destructive-foreground": "#ff6467",
  success: "#00bc7d",
  "success-foreground": "#00d492",
  warning: "#fe9a00",
  "warning-foreground": "#ffb900",
  info: "#2b7fff",
};

// Code and terminal colours drawn for this page.
const lightColours: ProSide = {
  syntax: {
    keyword: "#546895",
    string: "#487552",
    constant: "#8d5b44",
    function: "#35718c",
    type: "#7d6533",
    property: "#277676",
    parameter: "#8f575b",
  },
  ansi: {
    red: { normal: "#944a46", bright: "#bb6d67" },
    green: { normal: "#3b723e", bright: "#5e9660" },
    yellow: { normal: "#796006", bright: "#9e8337" },
    blue: { normal: "#39659b", bright: "#5c88c1" },
    magenta: { normal: "#834d7e", bright: "#a86fa3" },
    cyan: { normal: "#007176", bright: "#1c989e" },
  },
};

const darkColours: ProSide = {
  syntax: {
    keyword: "#abbee5",
    string: "#a3c9aa",
    constant: "#e0b29e",
    function: "#96c6dd",
    type: "#d0bb92",
    property: "#90caca",
    parameter: "#e2afb1",
  },
  ansi: {
    red: { normal: "#d2918b", bright: "#fbb7b0" },
    green: { normal: "#85b286", bright: "#aad9ab" },
    yellow: { normal: "#b8a369", bright: "#dfc98e" },
    blue: { normal: "#83a7d6", bright: "#a8ceff" },
    magenta: { normal: "#c293bd", bright: "#e9b8e4" },
    cyan: { normal: "#63b4b8", bright: "#89dbdf" },
  },
};

export const proGraphite: Theme = prohibitorumTheme(
  "pro-graphite",
  "ProGraphite",
  light,
  dark,
  { light: lightColours, dark: darkColours },
);
