/*
 * The Prohibitorum themes' shared shape. Their colours are Prohibitorum's
 * colour schemes, https://github.com/TundraWork/Prohibitorum, from
 * dashboard/src/styles/theme.css and schemes.css at commit 6d3bc42, which are
 * Apache-2.0; see this package's NOTICE. They are modified: each token is read
 * as a browser reads it (Tailwind CSS 4.3.3's palette, then Graphite's base,
 * then the scheme) and stored as opaque hex, Graphite's translucent fills laid
 * over the surface they sit on; Prohibitorum's names are mapped onto these
 * tokens; and the field edge, charts, diff colours, terminal and syntax
 * theme, which Prohibitorum does not define, are derived here.
 */
import { amoled } from "./amoled.ts";
import { contrastOf, mixOf, oklchOf } from "./color.ts";
import { markerOf } from "./marker.ts";
import { textMateTheme } from "./syntax.ts";
import type {
  ColorScheme,
  Palette,
  SyntaxRoles,
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

/** The six chromatic ANSI colours of one side, normal and bright. */
export type AnsiHues = Record<
  "red" | "green" | "yellow" | "blue" | "magenta" | "cyan",
  { normal: string; bright: string }
>;

/** The colours a theme draws for one side's code and terminal. */
export interface ProSide {
  syntax: SyntaxRoles;
  ansi: AnsiHues;
}

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
 * A chart series is a status fill, or, on a page too light for the fill to
 * clear 3:1, that status's text colour, a darker step of the same hue.
 */
function series(p: Published, fill: string, text: string): string {
  return contrastOf(fill, p.background) >= FIELD_EDGE ? fill : text;
}

/**
 * The terminal has no Prohibitorum colours either. Each theme draws its six
 * hues for its own page, or takes them from the family its page comes from,
 * normal ones at 4.5:1 and bright ones at 3:1. Black and white pair the page's
 * neutrals as Picotera's do, so the bright one of each pair is the lighter;
 * the cursor is the foreground and the selection the primary at 25%.
 */
function terminalOf(
  p: Published,
  scheme: ColorScheme,
  ansi: AnsiHues,
): TerminalTokens {
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
    "ansi-red": ansi.red.normal,
    "ansi-green": ansi.green.normal,
    "ansi-yellow": ansi.yellow.normal,
    "ansi-blue": ansi.blue.normal,
    "ansi-magenta": ansi.magenta.normal,
    "ansi-cyan": ansi.cyan.normal,
    "ansi-white": white,
    "ansi-bright-black": brightBlack,
    "ansi-bright-red": ansi.red.bright,
    "ansi-bright-green": ansi.green.bright,
    "ansi-bright-yellow": ansi.yellow.bright,
    "ansi-bright-blue": ansi.blue.bright,
    "ansi-bright-magenta": ansi.magenta.bright,
    "ansi-bright-cyan": ansi.cyan.bright,
    "ansi-bright-white": brightWhite,
  };
}

function paletteOf(
  p: Published,
  scheme: ColorScheme,
  id: string,
  side: ProSide,
): Palette {
  // Status text is Prohibitorum's `*-foreground`, which is what clears AA on
  // the page; the 500-step fills draw the diff, and the charts where they
  // read on the page.
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
    marker: markerOf(p),
    "chart-1": p.primary,
    "chart-2": series(p, p.success, p["success-foreground"]),
    "chart-3": series(p, p.warning, p["warning-foreground"]),
    "chart-4": series(p, p.destructive, p["destructive-foreground"]),
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
  return {
    tokens,
    terminal: terminalOf(p, scheme, side.ansi),
    syntax: textMateTheme(`orz-${id}-${scheme}`, scheme, side.syntax, tokens),
  };
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

/** A Prohibitorum scheme as a theme, with each side's code and terminal colours. */
export function prohibitorumTheme(
  id: string,
  label: string,
  light: Published,
  dark: Published,
  colours: { light: ProSide; dark: ProSide },
): Theme {
  const darkPalette = paletteOf(dark, "dark", id, colours.dark);
  return {
    id,
    label,
    light: paletteOf(light, "light", id, colours.light),
    dark: { ...darkPalette, variants: amoledOf(darkPalette) },
  };
}
