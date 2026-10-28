/*
 * The Prohibitorum themes' shared shape. Their colours are Prohibitorum's
 * colour schemes, https://github.com/TundraWork/Prohibitorum, from
 * dashboard/src/styles/theme.css and schemes.css at commit 6d3bc42, which are
 * Apache-2.0; see this package's NOTICE. They are modified: each token is read
 * as a browser reads it (Tailwind CSS 4.3.3's palette, then Graphite's base,
 * then the scheme) and stored as opaque hex, Graphite's translucent fills laid
 * over the surface they sit on; Prohibitorum's names are mapped onto these
 * tokens; and the field edge, charts, diff colours and terminal, which
 * Prohibitorum does not define, are derived here.
 */
import { amoled } from "./amoled.ts";
import { contrastOf, mixOf, oklchOf } from "./color.ts";
import type {
  ColorScheme,
  Palette,
  TerminalTokens,
  Theme,
  Tokens,
} from "./types.ts";

/**
 * One side of a scheme under Prohibitorum's own token names. Every
 * `*-foreground` it leaves out is `foreground` there, `secondary` is `muted`,
 * and `sidebar-primary` and its foreground are `primary`'s.
 */
export interface Published {
  background: string;
  foreground: string;
  card: string;
  popover: string;
  primary: string;
  "primary-foreground": string;
  muted: string;
  "muted-foreground": string;
  accent: string;
  border: string;
  ring: string;
  sidebar: string;
  "sidebar-foreground": string;
  "sidebar-accent": string;
  "sidebar-border": string;
  "sidebar-ring": string;
  /** The status fills; the matching `*-foreground` is the status text. */
  destructive: string;
  "destructive-foreground": string;
  success: string;
  "success-foreground": string;
  warning: string;
  "warning-foreground": string;
  info: string;
}

/** Tailwind CSS 4.3.3's 300, 400, 600 and 700 steps, as hex. */
const ANSI = {
  red: ["#ffa2a2", "#ff6467", "#e7000b", "#c10007"],
  green: ["#7bf1a8", "#05df72", "#00a63e", "#008236"],
  yellow: ["#ffdf20", "#fdc700", "#d08700", "#a65f00"],
  blue: ["#8ec5ff", "#51a2ff", "#155dfc", "#1447e6"],
  magenta: ["#f4a8ff", "#ed6aff", "#c800de", "#a800b7"],
  cyan: ["#53eafd", "#00d3f2", "#0092b8", "#007595"],
} as const;

/** WCAG 1.4.11's floor for the edge that identifies a field. */
const FIELD_EDGE = 3;

/**
 * Prohibitorum draws a field's edge with its border, which reads at well
 * under 3:1. The edge is the border mixed toward the foreground, in whole
 * percent, until it clears 3:1 on the page, a card and a popover.
 */
function fieldEdge(p: Published): string {
  for (let percent = 0; percent <= 100; percent++) {
    const edge = mixOf(p.border, p.foreground, percent / 100);
    if (
      [p.background, p.card, p.popover].every(
        (surface) => contrastOf(edge, surface) >= FIELD_EDGE,
      )
    )
      return edge;
  }
  return p.foreground;
}

/**
 * The terminal has no Prohibitorum colours either. The six hues are
 * Tailwind's, the family Prohibitorum's status colours come from: 700 and 600
 * for the normal and bright ones on a light page, 400 and 300 on a dark one.
 * Black and white pair the page's neutrals as Picotera's do, so the bright one
 * of each pair is the lighter; the cursor is the foreground and the selection
 * the primary at 25%.
 */
function terminalOf(p: Published, scheme: ColorScheme): TerminalTokens {
  const [bright, normal] = scheme === "light" ? [2, 3] : [1, 0];
  const hue = (name: keyof typeof ANSI, step: number) => ANSI[name][step];
  const [black, brightBlack, white, brightWhite] =
    scheme === "light"
      ? [p.foreground, p["muted-foreground"], p.border, p.background]
      : [p.background, p.border, p["muted-foreground"], p.foreground];
  return {
    "terminal-background": p.background,
    "terminal-foreground": p.foreground,
    "terminal-cursor": p.foreground,
    "terminal-selection": `${p.primary}40`,
    "ansi-black": black,
    "ansi-red": hue("red", normal),
    "ansi-green": hue("green", normal),
    "ansi-yellow": hue("yellow", normal),
    "ansi-blue": hue("blue", normal),
    "ansi-magenta": hue("magenta", normal),
    "ansi-cyan": hue("cyan", normal),
    "ansi-white": white,
    "ansi-bright-black": brightBlack,
    "ansi-bright-red": hue("red", bright),
    "ansi-bright-green": hue("green", bright),
    "ansi-bright-yellow": hue("yellow", bright),
    "ansi-bright-blue": hue("blue", bright),
    "ansi-bright-magenta": hue("magenta", bright),
    "ansi-bright-cyan": hue("cyan", bright),
    "ansi-bright-white": brightWhite,
  };
}

function paletteOf(
  p: Published,
  scheme: ColorScheme,
  syntax: string | undefined,
): Palette {
  // Status text is Prohibitorum's `*-foreground`, which is what clears AA on
  // the page; the 500-step fills draw the charts and the diff.
  const tokens: Tokens = {
    "diff-addition": p.success,
    "diff-deletion": p.destructive,
    background: p.background,
    foreground: p.foreground,
    card: p.card,
    "card-foreground": p.foreground,
    popover: p.popover,
    "popover-foreground": p.foreground,
    primary: p.primary,
    "primary-foreground": p["primary-foreground"],
    secondary: p.muted,
    "secondary-foreground": p.foreground,
    muted: p.muted,
    "muted-foreground": p["muted-foreground"],
    accent: p.accent,
    "accent-foreground": p.foreground,
    destructive: p["destructive-foreground"],
    success: p["success-foreground"],
    warning: p["warning-foreground"],
    border: p.border,
    input: fieldEdge(p),
    ring: p.ring,
    "chart-1": p.primary,
    "chart-2": p.success,
    "chart-3": p.warning,
    "chart-4": p.destructive,
    "chart-5": p.info,
    sidebar: p.sidebar,
    "sidebar-foreground": p["sidebar-foreground"],
    "sidebar-primary": p.primary,
    "sidebar-primary-foreground": p["primary-foreground"],
    "sidebar-accent": p["sidebar-accent"],
    "sidebar-accent-foreground": p.foreground,
    "sidebar-border": p["sidebar-border"],
    "sidebar-ring": p["sidebar-ring"],
  };
  const palette: Palette = { tokens, terminal: terminalOf(p, scheme) };
  if (syntax !== undefined) palette.syntax = syntax;
  return palette;
}

/**
 * AMOLED as Catppuccin's: every dark sidebar here sits below its page, so it
 * goes to black with the page, and the sidebar's highlight and border keep
 * their contrast with the sidebar instead.
 */
function amoledOf(palette: Palette): NonNullable<Palette["variants"]> {
  // amoled() derives from oklch() values only.
  const tokens = Object.fromEntries(
    Object.entries(palette.tokens).map(([name, value]) => [
      name,
      oklchOf(value),
    ]),
  ) as Tokens;
  const black = amoled({ ...palette, tokens });
  const onSidebar = amoled({
    ...palette,
    tokens: { ...tokens, background: tokens.sidebar },
  }).tokens;
  return {
    amoled: {
      ...black,
      tokens: {
        ...black.tokens,
        "sidebar-accent": onSidebar?.["sidebar-accent"],
        "sidebar-border": onSidebar?.["sidebar-border"],
      },
    },
  };
}

/** A Prohibitorum scheme as a theme, with `syntax` naming each side's shiki theme where one fits. */
export function prohibitorumTheme(
  id: string,
  label: string,
  light: Published,
  dark: Published,
  syntax: { light?: string; dark?: string } = {},
): Theme {
  const darkPalette = paletteOf(dark, "dark", syntax.dark);
  return {
    id,
    label,
    light: paletteOf(light, "light", syntax.light),
    dark: { ...darkPalette, variants: amoledOf(darkPalette) },
  };
}
