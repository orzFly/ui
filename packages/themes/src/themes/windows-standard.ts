import { textMateTheme } from "../syntax.ts";
import type { Palette, Theme } from "../types.ts";

// Windows 2000's "Windows Standard" scheme, its system colours as the
// display control panel ships them.
const FACE = "#d4d0c8";
const HIGHLIGHT = "#0a246a";

const palette: Palette = {
  tokens: {
    "diff-addition": "#008000",
    "diff-deletion": "#c00000",
    // Windows draws its windows, menus and dialogs on the 3D face; only fields
    // and list boxes take the white window colour (`window` below).
    background: FACE,
    foreground: "#000000",
    card: FACE,
    "card-foreground": "#000000",
    popover: FACE,
    "popover-foreground": "#000000",
    primary: HIGHLIGHT,
    "primary-foreground": "#ffffff",
    secondary: FACE,
    "secondary-foreground": "#000000",
    muted: FACE,
    // Windows has no secondary text but the disabled grey, at 2.6:1; this is
    // the darkest step that still reads apart from black.
    "muted-foreground": "#4d4a44",
    // The highlight colour is primary: raymond.css fills a highlighted menu
    // item or a selected list row with it. Accent stays what every palette
    // makes it, a soft fill under ordinary text, which an app's own hover
    // and current-item marks rely on: the highlight tinted into white.
    accent: "#dadee8",
    "accent-foreground": "#000000",
    destructive: "#a00000",
    success: "#006400",
    warning: "#6b5200",
    border: "#808080",
    // A field's inner edge, the 3D dark shadow: the outer one, the 3D shadow,
    // is 2.6:1 on the face.
    input: "#404040",
    ring: "#000000",
    marker: "#ffffff",
    "chart-1": "#000080",
    "chart-2": "#008000",
    "chart-3": "#800000",
    "chart-4": "#800080",
    "chart-5": "#008080",
    sidebar: FACE,
    "sidebar-foreground": "#000000",
    "sidebar-primary": HIGHLIGHT,
    "sidebar-primary-foreground": "#ffffff",
    "sidebar-accent": "#dadee8",
    "sidebar-accent-foreground": "#000000",
    "sidebar-border": "#808080",
    "sidebar-ring": "#000000",
  },
  styleTokens: {
    "3d-face": FACE,
    "3d-highlight": "#ffffff",
    "3d-light": FACE,
    "3d-shadow": "#808080",
    "3d-dark-shadow": "#404040",
    window: "#ffffff",
    caption: HIGHLIGHT,
    "caption-gradient": "#a6caf0",
    "caption-foreground": "#ffffff",
    "caption-inactive": "#808080",
    "caption-inactive-gradient": "#c0c0c0",
    "caption-inactive-foreground": FACE,
    info: "#ffffe1",
    "info-foreground": "#000000",
  },
  // Visual C++ 6's editor: blue keywords on the window white, the rest kept
  // near black.
  syntax: textMateTheme(
    "orz-windows-standard",
    "light",
    {
      keyword: "#0000ff",
      string: "#a31515",
      constant: "#800080",
      function: "#000080",
      type: "#008080",
      property: "#000000",
      parameter: "#000000",
    },
    {
      foreground: "#000000",
      background: "#ffffff",
      "muted-foreground": "#4d4a44",
    },
  ),
  // The console's sixteen colours on its own black, as Windows 2000 draws
  // it: its white and bright yellow vanish on a light ground.
  terminal: {
    "terminal-background": "#000000",
    "terminal-foreground": "#c0c0c0",
    "terminal-cursor": "#c0c0c0",
    "terminal-selection": "#0a246a",
    "ansi-black": "#000000",
    "ansi-red": "#800000",
    "ansi-green": "#008000",
    "ansi-yellow": "#808000",
    "ansi-blue": "#000080",
    "ansi-magenta": "#800080",
    "ansi-cyan": "#008080",
    "ansi-white": "#c0c0c0",
    "ansi-bright-black": "#808080",
    "ansi-bright-red": "#ff0000",
    "ansi-bright-green": "#00ff00",
    "ansi-bright-yellow": "#ffff00",
    "ansi-bright-blue": "#0000ff",
    "ansi-bright-magenta": "#ff00ff",
    "ansi-bright-cyan": "#00ffff",
    "ansi-bright-white": "#ffffff",
  },
};

/** Windows 2000's default scheme, for the raymond style. */
export const windowsStandard: Theme = {
  id: "windows-standard",
  label: "Windows Standard",
  styles: ["raymond"],
  light: palette,
};
