import { amoled } from "../amoled.ts";
import { selectionOf } from "../selection.ts";
import { textMateTheme } from "../syntax.ts";
import type { Palette, Theme, Tokens } from "../types.ts";

// Afterglow by yabatadesign: the terminal colours from Afterglow.itermcolors,
// https://github.com/YabataDesign/afterglow-itermcolors at acdd71f; the syntax
// roles from Afterglow.tmTheme, https://github.com/YabataDesign/afterglow-theme
// at 8af113f. The UI tokens are drawn from them: the scheme's own neutral
// greys, its amber as the accent, and its red, green, orange and magenta lifted
// to clear AA on the page. See NOTICE.

const page: Omit<Tokens, "selection"> = {
  "diff-addition": "#7e8e50",
  "diff-deletion": "#ac4142",
  background: "oklch(0.248 0 0)",
  foreground: "oklch(0.858 0 0)",
  card: "oklch(0.278 0 0)",
  "card-foreground": "oklch(0.858 0 0)",
  popover: "oklch(0.278 0 0)",
  "popover-foreground": "oklch(0.858 0 0)",
  primary: "oklch(0.8 0.111 78.25)",
  "primary-foreground": "oklch(0.248 0 0)",
  secondary: "oklch(0.309 0 0)",
  "secondary-foreground": "oklch(0.858 0 0)",
  muted: "oklch(0.309 0 0)",
  "muted-foreground": "oklch(0.7 0 0)",
  accent: "oklch(0.34 0.04 78)",
  "accent-foreground": "oklch(0.86 0.11 78)",
  destructive: "oklch(0.68 0.15 22.8)",
  success: "oklch(0.76 0.11 121)",
  warning: "oklch(0.72 0.133 56.5)",
  border: "oklch(0.355 0 0)",
  input: "oklch(0.565 0 0)",
  ring: "oklch(0.8 0.111 78.25)",
  marker: "oklch(0.33 0.035 78)",
  "selection-foreground": "oklch(0.858 0 0)",
  "chart-1": "oklch(0.8 0.111 78.25)",
  "chart-2": "oklch(0.663 0.07 241.7)",
  "chart-3": "oklch(0.76 0.11 121)",
  "chart-4": "oklch(0.66 0.127 341)",
  "chart-5": "oklch(0.818 0.087 189.1)",
  sidebar: "oklch(0.248 0 0)",
  "sidebar-foreground": "oklch(0.7 0 0)",
  "sidebar-primary": "oklch(0.8 0.111 78.25)",
  "sidebar-primary-foreground": "oklch(0.248 0 0)",
  "sidebar-accent": "oklch(0.34 0.04 78)",
  "sidebar-accent-foreground": "oklch(0.86 0.11 78)",
  "sidebar-border": "oklch(0.355 0 0)",
  "sidebar-ring": "oklch(0.8 0.111 78.25)",
};

const tokens: Tokens = { ...page, selection: selectionOf(page, "#303030") };

const darkPalette: Palette = {
  tokens,
  syntax: textMateTheme(
    "orz-afterglow",
    "dark",
    {
      keyword: "#cc7833",
      string: "#b4c973",
      constant: "#6c99bb",
      function: "#ffc66d",
      type: "#6c99bb",
      property: "#d0d0ff",
      parameter: "#d0d0ff",
    },
    tokens,
  ),
  terminal: {
    "terminal-background": "#212121",
    "terminal-foreground": "#d0d0d0",
    "terminal-cursor": "#d0d0d0",
    "terminal-selection": "#303030",
    "ansi-black": "#151515",
    "ansi-red": "#ac4142",
    "ansi-green": "#7e8e50",
    "ansi-yellow": "#e5b567",
    "ansi-blue": "#6c99bb",
    "ansi-magenta": "#9f4e85",
    "ansi-cyan": "#7dd6cf",
    "ansi-white": "#d0d0d0",
    "ansi-bright-black": "#505050",
    "ansi-bright-red": "#ac4142",
    "ansi-bright-green": "#7e8e50",
    "ansi-bright-yellow": "#e5b567",
    "ansi-bright-blue": "#6c99bb",
    "ansi-bright-magenta": "#9f4e85",
    "ansi-bright-cyan": "#7dd6cf",
    "ansi-bright-white": "#f5f5f5",
  },
};

export const afterglow: Theme = {
  id: "afterglow",
  label: "Afterglow",
  dark: { ...darkPalette, variants: { amoled: amoled(darkPalette) } },
};
