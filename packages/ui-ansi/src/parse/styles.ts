import type { AnsiColor, AnsiStyle } from "./types.ts";

const FLAGS = [
  "bold",
  "dim",
  "italic",
  "blink",
  "inverse",
  "hidden",
  "strike",
  "overline",
] as const;

function colorKey(color: AnsiColor | undefined): string {
  if (!color) return "";
  return color.kind === "palette"
    ? `p${color.index}`
    : `${color.r},${color.g},${color.b}`;
}

function keyOf(style: AnsiStyle): string {
  let flags = 0;
  for (let i = 0; i < FLAGS.length; i++) {
    if (style[FLAGS[i] as (typeof FLAGS)[number]]) flags |= 1 << i;
  }
  // href goes last and unescaped: no field after it can blur its boundary.
  return `${colorKey(style.fg)}|${colorKey(style.bg)}|${colorKey(style.underlineColor)}|${flags}|${style.underline ?? ""}|${style.href ?? ""}`;
}

// Only the set fields are stored, so interned styles compare cleanly.
function compact(style: AnsiStyle): AnsiStyle {
  const out: AnsiStyle = {};
  if (style.fg) out.fg = style.fg;
  if (style.bg) out.bg = style.bg;
  if (style.underlineColor) out.underlineColor = style.underlineColor;
  for (const flag of FLAGS) if (style[flag]) out[flag] = true;
  if (style.underline) out.underline = style.underline;
  if (style.href !== undefined) out.href = style.href;
  return out;
}

/** Gives equal styles one shared id; id 0 is the empty style. */
export class StyleTable {
  readonly styles: AnsiStyle[] = [{}];
  private readonly ids = new Map<string, number>([[keyOf({}), 0]]);

  /** The id of the SGR state `style` with the open link, if any, folded in. */
  intern(style: AnsiStyle, href?: string): number {
    const full = href === undefined ? style : { ...style, href };
    const key = keyOf(full);
    let id = this.ids.get(key);
    if (id === undefined) {
      id = this.styles.length;
      this.styles.push(compact(full));
      this.ids.set(key, id);
    }
    return id;
  }
}
