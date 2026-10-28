import { type Published, prohibitorumTheme } from "../prohibitorum.ts";
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

export const proGraphite: Theme = prohibitorumTheme(
  "pro-graphite",
  "ProGraphite",
  light,
  dark,
);
