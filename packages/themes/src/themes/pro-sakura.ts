import { type Published, prohibitorumTheme } from "../prohibitorum.ts";
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

export const proSakura: Theme = prohibitorumTheme(
  "pro-sakura",
  "ProSakura",
  light,
  dark,
);
