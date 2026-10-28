import { type Published, prohibitorumTheme } from "../prohibitorum.ts";
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

export const proNord: Theme = prohibitorumTheme(
  "pro-nord",
  "ProNord",
  light,
  dark,
  { dark: "nord" },
);
