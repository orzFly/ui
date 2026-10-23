import type { CSSProperties } from "react";
import { PALETTE_NAMES, xterm256 } from "../parse/palette.ts";
import type { AnsiColor, AnsiStyle, UnderlineStyle } from "../parse/types.ts";

const FOREGROUND = "var(--terminal-foreground)";
const BACKGROUND = "var(--terminal-background)";

const DECORATION_STYLE: Record<
  UnderlineStyle,
  CSSProperties["textDecorationStyle"]
> = {
  single: "solid",
  double: "double",
  curly: "wavy",
  dotted: "dotted",
  dashed: "dashed",
};

function colorCss(color: AnsiColor): string {
  if (color.kind === "rgb") return `rgb(${color.r} ${color.g} ${color.b})`;
  // 0–15 stay theme variables, so switching the palette needs no re-render.
  if (color.index < 16) return `var(--ansi-${PALETTE_NAMES[color.index]})`;
  const { r, g, b } = xterm256(color.index);
  return `rgb(${r} ${g} ${b})`;
}

/** The inline style for a run. Unset colours inherit the block's terminal defaults. */
export function styleToCss(
  style: AnsiStyle,
  boldIsBright: boolean,
): CSSProperties {
  const css: CSSProperties = {};
  let fg = style.fg;
  if (boldIsBright && style.bold && fg?.kind === "palette" && fg.index < 8) {
    fg = { kind: "palette", index: fg.index + 8 };
  }
  let color = fg && colorCss(fg);
  let background = style.bg && colorCss(style.bg);
  if (style.inverse) {
    [color, background] = [background ?? BACKGROUND, color ?? FOREGROUND];
  }
  if (style.hidden) {
    color = "transparent";
  } else if (style.dim) {
    // Mixing the colour, unlike opacity, leaves the run's background undimmed.
    color = `color-mix(in oklab, ${color ?? FOREGROUND} 60%, ${BACKGROUND})`;
  }
  if (color) css.color = color;
  if (background) css.backgroundColor = background;
  if (style.bold) css.fontWeight = 700;
  if (style.italic) css.fontStyle = "italic";

  const lines: string[] = [];
  if (style.underline) {
    lines.push("underline");
    css.textDecorationStyle = DECORATION_STYLE[style.underline];
    // CSS has one decoration colour for every line; SGR 58 is meant for the underline.
    if (style.underlineColor)
      css.textDecorationColor = colorCss(style.underlineColor);
  } else if (style.href) {
    lines.push("underline");
    css.textDecorationStyle = "dotted";
  }
  if (style.strike) lines.push("line-through");
  if (style.overline) lines.push("overline");
  if (lines.length > 0) css.textDecorationLine = lines.join(" ");
  return css;
}

/**
 * A memoised {@link styleToCss} over a parse's interned styles, keyed by style
 * id and `boldIsBright`. `styles` is read on each miss, so it may grow while a
 * stream is parsed.
 */
export function createStyleCache(
  styles: readonly AnsiStyle[],
): (id: number, boldIsBright: boolean) => CSSProperties {
  const cache = new Map<number, CSSProperties>();
  return (id, boldIsBright) => {
    const key = id * 2 + (boldIsBright ? 1 : 0);
    let css = cache.get(key);
    if (css) return css;
    const style = styles[id];
    css = styleToCss(style ?? {}, boldIsBright);
    // An id the parse has not interned yet must not pin the empty style.
    if (style) cache.set(key, css);
    return css;
  };
}
