import { type Published, prohibitorumTheme } from "../prohibitorum.ts";
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

export const proLagoon: Theme = prohibitorumTheme(
  "pro-lagoon",
  "ProLagoon",
  light,
  dark,
);
