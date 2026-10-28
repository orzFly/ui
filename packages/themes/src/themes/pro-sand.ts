import { type Published, prohibitorumTheme } from "../prohibitorum.ts";
import type { Theme } from "../types.ts";

// Prohibitorum's Sand scheme, resolved to hex; see src/prohibitorum.ts.
const light: Published = {
  background: "#fdfdfc",
  foreground: "#21201c",
  card: "#ffffff",
  popover: "#ffffff",
  primary: "#553c2b",
  "primary-foreground": "#ffffff",
  muted: "#f1f0ef",
  "muted-foreground": "#63635e",
  accent: "#e9e8e6",
  border: "#dad9d6",
  ring: "#9d775e",
  sidebar: "#f6f3ef",
  "sidebar-foreground": "#51514c",
  "sidebar-accent": "#e9e8e6",
  "sidebar-border": "#dad9d6",
  "sidebar-ring": "#9d775e",
  destructive: "#fb2c36",
  "destructive-foreground": "#c10007",
  success: "#00bc7d",
  "success-foreground": "#007a55",
  warning: "#fe9a00",
  "warning-foreground": "#bb4d00",
  info: "#2b7fff",
};

const dark: Published = {
  background: "#111110",
  foreground: "#eeeeec",
  card: "#191918",
  popover: "#191918",
  primary: "#dfc1a6",
  "primary-foreground": "#21201c",
  muted: "#222221",
  "muted-foreground": "#b5b3ad",
  accent: "#2a2a28",
  border: "#3b3a37",
  ring: "#bb9679",
  sidebar: "#0c0c0b",
  "sidebar-foreground": "#b5b3ad",
  "sidebar-accent": "#2a2a28",
  "sidebar-border": "#3b3a37",
  "sidebar-ring": "#bb9679",
  destructive: "#fb414a",
  "destructive-foreground": "#ff6467",
  success: "#00bc7d",
  "success-foreground": "#00d492",
  warning: "#fe9a00",
  "warning-foreground": "#ffb900",
  info: "#2b7fff",
};

export const proSand: Theme = prohibitorumTheme(
  "pro-sand",
  "ProSand",
  light,
  dark,
);
