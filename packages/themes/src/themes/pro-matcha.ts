import { type Published, prohibitorumTheme } from "../prohibitorum.ts";
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

export const proMatcha: Theme = prohibitorumTheme(
  "pro-matcha",
  "ProMatcha",
  light,
  dark,
  { light: "everforest-light", dark: "everforest-dark" },
);
