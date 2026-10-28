import {
  type ProSide,
  type Published,
  prohibitorumTheme,
} from "../prohibitorum.ts";
import type { Theme } from "../types.ts";

// Prohibitorum's Citrus scheme, resolved to hex; see src/prohibitorum.ts.
const light: Published = {
  background: "#fdfcf3",
  foreground: "#282413",
  card: "#ffffff",
  popover: "#ffffff",
  primary: "#eae14a",
  "primary-foreground": "#282413",
  muted: "#f6f4e5",
  "muted-foreground": "#676047",
  accent: "#f3f1cb",
  border: "#e6e2cc",
  ring: "#8c8300",
  sidebar: "#f9f6e3",
  "sidebar-foreground": "#585137",
  "sidebar-accent": "#f3f1cb",
  "sidebar-border": "#e6e2cc",
  "sidebar-ring": "#8c8300",
  destructive: "#fb2c36",
  "destructive-foreground": "#c10007",
  success: "#00bc7d",
  "success-foreground": "#007a55",
  warning: "#fe9a00",
  "warning-foreground": "#bb4d00",
  info: "#2b7fff",
};

const dark: Published = {
  background: "#15140e",
  foreground: "#f1efe0",
  card: "#1c1b13",
  popover: "#1c1b13",
  primary: "#e7ea6a",
  "primary-foreground": "#15140e",
  muted: "#26241b",
  "muted-foreground": "#b5b29c",
  accent: "#302f1d",
  border: "#37362c",
  ring: "#e7ea6a",
  sidebar: "#0f0e0a",
  "sidebar-foreground": "#b5b29c",
  "sidebar-accent": "#302f1d",
  "sidebar-border": "#37362c",
  "sidebar-ring": "#e7ea6a",
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
    keyword: "#736c00",
    string: "#007c59",
    constant: "#a44c1d",
    function: "#1f6cb0",
    type: "#7555a8",
    property: "#00787d",
    parameter: "#a74449",
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
    keyword: "#c8c26b",
    string: "#73d4ac",
    constant: "#f9a782",
    function: "#89c3ff",
    type: "#c8aefa",
    property: "#56d3da",
    parameter: "#fda1a0",
  },
  ansi: {
    red: { normal: "#e18881", bright: "#ffb5ae" },
    green: { normal: "#77b779", bright: "#9dde9e" },
    yellow: { normal: "#bfa14c", bright: "#e6c873" },
    blue: { normal: "#74a7e8", bright: "#a7ceff" },
    magenta: { normal: "#cc8bc5", bright: "#f4b0ed" },
    cyan: { normal: "#35b9c0", bright: "#65e0e7" },
  },
};

export const proCitrus: Theme = prohibitorumTheme(
  "pro-citrus",
  "ProCitrus",
  light,
  dark,
  { light: lightColours, dark: darkColours },
);
