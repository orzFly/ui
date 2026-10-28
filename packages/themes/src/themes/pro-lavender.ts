import { type Published, prohibitorumTheme } from "../prohibitorum.ts";
import type { Theme } from "../types.ts";

// Prohibitorum's Lavender scheme, resolved to hex; see src/prohibitorum.ts.
const light: Published = {
  background: "#eff1f5",
  foreground: "#4c4f69",
  card: "#ffffff",
  popover: "#ffffff",
  primary: "#8839ef",
  "primary-foreground": "#ffffff",
  muted: "#e6e9ef",
  "muted-foreground": "#5c5f77",
  accent: "#ece5fb",
  border: "#ccd0da",
  ring: "#8839ef",
  sidebar: "#e6e9ef",
  "sidebar-foreground": "#464960",
  "sidebar-accent": "#ece5fb",
  "sidebar-border": "#ccd0da",
  "sidebar-ring": "#8839ef",
  destructive: "#fb2c36",
  "destructive-foreground": "#c10007",
  success: "#00bc7d",
  "success-foreground": "#007a55",
  warning: "#fe9a00",
  "warning-foreground": "#973c00",
  info: "#2b7fff",
};

const dark: Published = {
  background: "#1e1e2e",
  foreground: "#cdd6f4",
  card: "#24243a",
  popover: "#24243a",
  primary: "#cba6f7",
  "primary-foreground": "#1e1e2e",
  muted: "#313244",
  "muted-foreground": "#a6adc8",
  accent: "#313244",
  border: "#45475a",
  ring: "#cba6f7",
  sidebar: "#181825",
  "sidebar-foreground": "#a6adc8",
  "sidebar-accent": "#313244",
  "sidebar-border": "#45475a",
  "sidebar-ring": "#cba6f7",
  destructive: "#fb414a",
  "destructive-foreground": "#ff6467",
  success: "#00bc7d",
  "success-foreground": "#00d492",
  warning: "#fe9a00",
  "warning-foreground": "#ffb900",
  info: "#2b7fff",
};

export const proLavender: Theme = prohibitorumTheme(
  "pro-lavender",
  "ProLavender",
  light,
  dark,
  { light: "catppuccin-latte", dark: "catppuccin-mocha" },
);
