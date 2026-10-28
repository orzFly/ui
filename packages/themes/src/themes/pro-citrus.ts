import { type Published, prohibitorumTheme } from "../prohibitorum.ts";
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

export const proCitrus: Theme = prohibitorumTheme(
  "pro-citrus",
  "ProCitrus",
  light,
  dark,
);
