import {
  type ProSide,
  type Published,
  prohibitorumTheme,
} from "../prohibitorum.ts";
import type { Theme } from "../types.ts";

// Prohibitorum's Nord scheme, resolved to hex; see src/prohibitorum.ts.
const light: Published = {
  background: "#eceff4",
  foreground: "#2e3440",
  card: "#ffffff",
  popover: "#ffffff",
  primary: "#406593",
  "primary-foreground": "#ffffff",
  muted: "#e5e9f0",
  "muted-foreground": "#4c566a",
  accent: "#d6e5f3",
  border: "#d8dee9",
  ring: "#5e81ac",
  sidebar: "#e5e9f0",
  "sidebar-foreground": "#404a5d",
  "sidebar-accent": "#d6e5f3",
  "sidebar-border": "#d8dee9",
  "sidebar-ring": "#5e81ac",
  destructive: "#fb2c36",
  "destructive-foreground": "#c10007",
  success: "#00bc7d",
  "success-foreground": "#007a55",
  warning: "#fe9a00",
  "warning-foreground": "#973c00",
  info: "#2b7fff",
};

const dark: Published = {
  background: "#292e39",
  foreground: "#eceff4",
  card: "#2e3440",
  popover: "#2e3440",
  primary: "#88c0d0",
  "primary-foreground": "#2e3440",
  muted: "#3b4252",
  "muted-foreground": "#adb9c8",
  accent: "#434c5e",
  border: "#434c5e",
  ring: "#88c0d0",
  sidebar: "#242933",
  "sidebar-foreground": "#adb9c8",
  "sidebar-accent": "#434c5e",
  "sidebar-border": "#434c5e",
  "sidebar-ring": "#88c0d0",
  destructive: "#fb414a",
  "destructive-foreground": "#ffa2a2",
  success: "#00bc7d",
  "success-foreground": "#00d492",
  warning: "#fe9a00",
  "warning-foreground": "#ffb900",
  info: "#2b7fff",
};

// Nord's published accents, moved in lightness only where one misses its
// floor on this page; Nord publishes no light side, so that one is darkened.
const lightColours: ProSide = {
  syntax: {
    keyword: "#496b95",
    string: "#597143",
    constant: "#815e7b",
    function: "#3a707f",
    type: "#467171",
    property: "#4e6c8a",
    parameter: "#9c5742",
  },
  ansi: {
    red: { normal: "#ab4f59", bright: "#cd6d76" },
    green: { normal: "#5c7446", bright: "#789062" },
    yellow: { normal: "#866828", bright: "#a38445" },
    blue: { normal: "#516f8d", bright: "#6e8dac" },
    magenta: { normal: "#84607e", bright: "#a37d9c" },
    cyan: { normal: "#3c7382", bright: "#5a91a0" },
  },
};

const darkColours: ProSide = {
  syntax: {
    keyword: "#81a1c1",
    string: "#a3be8c",
    constant: "#b48ead",
    function: "#88c0d0",
    type: "#8fbcbb",
    property: "#d8dee9",
    parameter: "#d08770",
  },
  ansi: {
    red: { normal: "#da7981", bright: "#f69299" },
    green: { normal: "#a3be8c", bright: "#bcd8a5" },
    yellow: { normal: "#ebcb8b", bright: "#ffe7b6" },
    blue: { normal: "#81a1c1", bright: "#99badb" },
    magenta: { normal: "#b48ead", bright: "#cea7c6" },
    cyan: { normal: "#88c0d0", bright: "#a1daea" },
  },
};

export const proNord: Theme = prohibitorumTheme(
  "pro-nord",
  "ProNord",
  light,
  dark,
  { light: lightColours, dark: darkColours },
);
