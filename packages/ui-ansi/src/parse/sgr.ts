import type { AnsiColor, AnsiStyle, UnderlineStyle } from "./types.ts";

const UNDERLINES: readonly (UnderlineStyle | undefined)[] = [
  undefined,
  "single",
  "double",
  "curly",
  "dotted",
  "dashed",
];

// An empty parameter means 0; a missing one is NaN, so it fails every check.
function num(value: string | undefined): number {
  return value === undefined ? Number.NaN : Number(value);
}

function byte(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function paletteColor(index: number): AnsiColor | undefined {
  return byte(index) ? { kind: "palette", index } : undefined;
}

function rgbColor(
  r: string | undefined,
  g: string | undefined,
  b: string | undefined,
): AnsiColor | undefined {
  const [rn, gn, bn] = [num(r), num(g), num(b)];
  return byte(rn) && byte(gn) && byte(bn)
    ? { kind: "rgb", r: rn, g: gn, b: bn }
    : undefined;
}

/**
 * Reads the colour of a `38`/`48`/`58` at `params[i]`. A malformed one still
 * consumes its arguments, so they are never read again as codes of their own.
 */
function readColor(
  params: readonly (readonly string[])[],
  i: number,
): { color: AnsiColor | undefined; next: number } {
  const param = params[i] as readonly string[];
  if (param.length > 1) {
    const mode = num(param[1]);
    if (mode === 5) return { color: paletteColor(num(param[2])), next: i + 1 };
    if (mode === 2) {
      // `38:2::r:g:b` names a colour space before the components; `38:2:r:g:b` does not.
      const at = param.length >= 6 ? 3 : 2;
      return {
        color: rgbColor(param[at], param[at + 1], param[at + 2]),
        next: i + 1,
      };
    }
    return { color: undefined, next: i + 1 };
  }
  const main = (k: number) => params[k]?.[0];
  const mode = num(main(i + 1));
  if (mode === 5) {
    return {
      color: paletteColor(num(main(i + 2))),
      next: Math.min(i + 3, params.length),
    };
  }
  if (mode === 2) {
    return {
      color: rgbColor(main(i + 2), main(i + 3), main(i + 4)),
      next: Math.min(i + 5, params.length),
    };
  }
  return { color: undefined, next: Math.min(i + 2, params.length) };
}

/**
 * The SGR state after `CSI params m`. `params` is already split on `;` and
 * then on `:`. The link is not SGR state, so it is not here.
 */
export function applySgr(
  style: AnsiStyle,
  params: readonly (readonly string[])[],
): AnsiStyle {
  const s: AnsiStyle = { ...style };
  if (params.length === 0) return {};
  let i = 0;
  while (i < params.length) {
    const param = params[i] as readonly string[];
    const code = num(param[0]);
    if (code === 38 || code === 48 || code === 58) {
      const { color, next } = readColor(params, i);
      if (color) {
        if (code === 38) s.fg = color;
        else if (code === 48) s.bg = color;
        else s.underlineColor = color;
      }
      i = next;
      continue;
    }
    i++;
    if (code >= 30 && code <= 37) s.fg = { kind: "palette", index: code - 30 };
    else if (code >= 90 && code <= 97)
      s.fg = { kind: "palette", index: code - 90 + 8 };
    else if (code >= 40 && code <= 47)
      s.bg = { kind: "palette", index: code - 40 };
    else if (code >= 100 && code <= 107)
      s.bg = { kind: "palette", index: code - 100 + 8 };
    else
      switch (code) {
        case 0:
          for (const key of Object.keys(s)) delete s[key as keyof AnsiStyle];
          break;
        case 1:
          s.bold = true;
          break;
        case 2:
          s.dim = true;
          break;
        case 3:
          s.italic = true;
          break;
        case 4: {
          if (param.length === 1) {
            s.underline = "single";
            break;
          }
          const sub = num(param[1]);
          if (sub === 0) delete s.underline;
          else if (sub >= 1 && sub <= 5) s.underline = UNDERLINES[sub];
          break;
        }
        case 5:
        case 6:
          s.blink = true;
          break;
        case 7:
          s.inverse = true;
          break;
        case 8:
          s.hidden = true;
          break;
        case 9:
          s.strike = true;
          break;
        case 21:
          s.underline = "double";
          break;
        case 22:
          delete s.bold;
          delete s.dim;
          break;
        case 23:
          delete s.italic;
          break;
        case 24:
          delete s.underline;
          break;
        case 25:
          delete s.blink;
          break;
        case 27:
          delete s.inverse;
          break;
        case 28:
          delete s.hidden;
          break;
        case 29:
          delete s.strike;
          break;
        case 39:
          delete s.fg;
          break;
        case 49:
          delete s.bg;
          break;
        case 53:
          s.overline = true;
          break;
        case 55:
          delete s.overline;
          break;
        case 59:
          delete s.underlineColor;
          break;
      }
  }
  return s;
}
