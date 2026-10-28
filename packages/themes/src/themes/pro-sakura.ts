import {
  type ProSide,
  type Published,
  prohibitorumTheme,
} from "../prohibitorum.ts";
import type { Theme } from "../types.ts";

// Prohibitorum's Sakura scheme, resolved to hex; see src/prohibitorum.ts.
const light: Published = {
  background: "#fff8fb",
  foreground: "#32202c",
  card: "#ffffff",
  popover: "#ffffff",
  primary: "#c33278",
  "primary-foreground": "#ffffff",
  muted: "#f9ecf2",
  "muted-foreground": "#765969",
  accent: "#fce3ed",
  border: "#ecd8e0",
  ring: "#dc5b92",
  sidebar: "#feeff5",
  "sidebar-foreground": "#664657",
  "sidebar-accent": "#fce3ed",
  "sidebar-border": "#ecd8e0",
  "sidebar-ring": "#dc5b92",
  destructive: "#fb2c36",
  "destructive-foreground": "#c10007",
  success: "#00bc7d",
  "success-foreground": "#007a55",
  warning: "#fe9a00",
  "warning-foreground": "#bb4d00",
  info: "#2b7fff",
};

const dark: Published = {
  background: "#1a1017",
  foreground: "#f4e7ec",
  card: "#23161e",
  popover: "#23161e",
  primary: "#f7a0c0",
  "primary-foreground": "#1a1017",
  muted: "#2e1e29",
  "muted-foreground": "#bfa6b3",
  accent: "#412331",
  border: "#432e39",
  ring: "#f7a0c0",
  sidebar: "#140b11",
  "sidebar-foreground": "#bfa6b3",
  "sidebar-accent": "#412331",
  "sidebar-border": "#432e39",
  "sidebar-ring": "#f7a0c0",
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
    keyword: "#a4406d",
    string: "#0a7e3a",
    constant: "#a84811",
    function: "#7055b0",
    type: "#896100",
    property: "#007399",
    parameter: "#904895",
  },
  ansi: {
    red: { normal: "#a43b38", bright: "#cd605a" },
    green: { normal: "#1e7729", bright: "#479c4d" },
    yellow: { normal: "#7a6000", bright: "#a48200" },
    blue: { normal: "#2063b0", bright: "#4687d8" },
    magenta: { normal: "#8e4088", bright: "#b464ae" },
    cyan: { normal: "#007176", bright: "#00999f" },
  },
};

const darkColours: ProSide = {
  syntax: {
    keyword: "#f6a0c1",
    string: "#89d298",
    constant: "#f9a782",
    function: "#c3b0fd",
    type: "#e3b667",
    property: "#6bcbf7",
    parameter: "#e2a5e5",
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

export const proSakura: Theme = prohibitorumTheme(
  "pro-sakura",
  "ProSakura",
  light,
  dark,
  { light: lightColours, dark: darkColours },
);
