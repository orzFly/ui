import {
  type ProSide,
  type Published,
  prohibitorumTheme,
} from "../prohibitorum.ts";
import type { Theme } from "../types.ts";

// Prohibitorum's Matcha scheme, resolved to hex; see src/prohibitorum.ts.
const light: Published = {
  background: "#fdf6e3",
  foreground: "#4f5b62",
  card: "#fffbef",
  popover: "#fffbef",
  primary: "#5c6f21",
  "primary-foreground": "#ffffff",
  muted: "#f4f0d9",
  "muted-foreground": "#57685e",
  accent: "#efebd4",
  border: "#e0dcc7",
  ring: "#5c6f21",
  sidebar: "#f4f0d9",
  "sidebar-foreground": "#415148",
  "sidebar-accent": "#efebd4",
  "sidebar-border": "#e0dcc7",
  "sidebar-ring": "#5c6f21",
  destructive: "#fb2c36",
  "destructive-foreground": "#c10007",
  success: "#00bc7d",
  "success-foreground": "#007a55",
  warning: "#fe9a00",
  "warning-foreground": "#bb4d00",
  info: "#2b7fff",
};

const dark: Published = {
  background: "#272e33",
  foreground: "#d3c6aa",
  card: "#2e383c",
  popover: "#2e383c",
  primary: "#a7c080",
  "primary-foreground": "#2d353b",
  muted: "#374145",
  "muted-foreground": "#a3b1a5",
  accent: "#414b50",
  border: "#495156",
  ring: "#a7c080",
  sidebar: "#1e2326",
  "sidebar-foreground": "#a3b1a5",
  "sidebar-accent": "#414b50",
  "sidebar-border": "#495156",
  "sidebar-ring": "#a7c080",
  destructive: "#fb414a",
  "destructive-foreground": "#ffa2a2",
  success: "#00bc7d",
  "success-foreground": "#00d492",
  warning: "#fe9a00",
  "warning-foreground": "#ffb900",
  info: "#2b7fff",
};

// Everforest's published accents, moved in lightness only where one misses
// its floor on this page.
const lightColours: ProSide = {
  syntax: {
    keyword: "#d02c31",
    string: "#007d58",
    constant: "#b44193",
    function: "#667500",
    type: "#916600",
    property: "#0e75a5",
    parameter: "#b15300",
  },
  ansi: {
    red: { normal: "#d43034", bright: "#f85552" },
    green: { normal: "#687800", bright: "#859631" },
    yellow: { normal: "#946900", bright: "#b38732" },
    blue: { normal: "#1177a6", bright: "#3c96c6" },
    magenta: { normal: "#b64394", bright: "#d863b3" },
    cyan: { normal: "#00815b", bright: "#37a078" },
  },
};

const darkColours: ProSide = {
  syntax: {
    keyword: "#e67e80",
    string: "#83c092",
    constant: "#d699b6",
    function: "#a7c080",
    type: "#dbbc7f",
    property: "#7fbbb3",
    parameter: "#e69875",
  },
  ansi: {
    red: { normal: "#e67e80", bright: "#ff999a" },
    green: { normal: "#a7c080", bright: "#c0da99" },
    yellow: { normal: "#dbbc7f", bright: "#f6d698" },
    blue: { normal: "#7fbbb3", bright: "#98d5cc" },
    magenta: { normal: "#d699b6", bright: "#f1b2d0" },
    cyan: { normal: "#83c092", bright: "#9cdaab" },
  },
};

export const proMatcha: Theme = prohibitorumTheme(
  "pro-matcha",
  "ProMatcha",
  light,
  dark,
  { light: lightColours, dark: darkColours },
);
