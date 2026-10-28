import {
  type ProSide,
  type Published,
  prohibitorumTheme,
} from "../prohibitorum.ts";
import type { Theme } from "../types.ts";

// Prohibitorum's Lagoon scheme, resolved to hex; see src/prohibitorum.ts.
const light: Published = {
  background: "#f3fcfb",
  foreground: "#112a33",
  card: "#ffffff",
  popover: "#ffffff",
  primary: "#117393",
  "primary-foreground": "#ffffff",
  muted: "#e3f4f4",
  "muted-foreground": "#496972",
  accent: "#caf1f2",
  border: "#cce3e4",
  ring: "#0995b2",
  sidebar: "#e3f8f6",
  "sidebar-foreground": "#2f555e",
  "sidebar-accent": "#caf1f2",
  "sidebar-border": "#cce3e4",
  "sidebar-ring": "#0995b2",
  destructive: "#fb2c36",
  "destructive-foreground": "#c10007",
  success: "#00bc7d",
  "success-foreground": "#007a55",
  warning: "#fe9a00",
  "warning-foreground": "#bb4d00",
  info: "#2b7fff",
};

const dark: Published = {
  background: "#06161c",
  foreground: "#e4f2f2",
  card: "#0a1e24",
  popover: "#0a1e24",
  primary: "#5ddae0",
  "primary-foreground": "#06161c",
  muted: "#12272e",
  "muted-foreground": "#98b8bd",
  accent: "#0a3438",
  border: "#233940",
  ring: "#5ddae0",
  sidebar: "#041016",
  "sidebar-foreground": "#98b8bd",
  "sidebar-accent": "#0a3438",
  "sidebar-border": "#233940",
  "sidebar-ring": "#5ddae0",
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
    keyword: "#00758e",
    string: "#007d51",
    constant: "#a14d2f",
    function: "#3e68ad",
    type: "#856300",
    property: "#6f59a6",
    parameter: "#984979",
  },
  ansi: {
    red: { normal: "#a03f3c", bright: "#c8635d" },
    green: { normal: "#27762f", bright: "#4e9a52" },
    yellow: { normal: "#7a6000", bright: "#a48200" },
    blue: { normal: "#2863ab", bright: "#4c88d3" },
    magenta: { normal: "#8b4486", bright: "#b167ab" },
    cyan: { normal: "#007176", bright: "#00999f" },
  },
};

const darkColours: ProSide = {
  syntax: {
    keyword: "#6ccdea",
    string: "#82d2a8",
    constant: "#f6a88d",
    function: "#98bffe",
    type: "#dbb970",
    property: "#c2b1f8",
    parameter: "#eda4cc",
  },
  ansi: {
    red: { normal: "#dc8c85", bright: "#ffb5ae" },
    green: { normal: "#7cb57d", bright: "#a1dca2" },
    yellow: { normal: "#bda257", bright: "#e4c87c" },
    blue: { normal: "#79a7e2", bright: "#a7ceff" },
    magenta: { normal: "#c88ec3", bright: "#f0b3ea" },
    cyan: { normal: "#48b7bd", bright: "#72dee4" },
  },
};

export const proLagoon: Theme = prohibitorumTheme(
  "pro-lagoon",
  "ProLagoon",
  light,
  dark,
  { light: lightColours, dark: darkColours },
);
