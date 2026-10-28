export type Rgb = [number, number, number];
export type Lab = [number, number, number];

export function oklab(spec: string): Lab {
  const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(spec);
  if (!m) throw new Error(`not a plain oklch() colour: ${spec}`);
  const hue = (Number(m[3]) * Math.PI) / 180;
  return [
    Number(m[1]),
    Number(m[2]) * Math.cos(hue),
    Number(m[2]) * Math.sin(hue),
  ];
}

/** CSS Color 4's Oklab matrices, then the sRGB transfer function. */
export function srgb([lightness, a, b]: Lab): Rgb {
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const encode = (v: number) => {
    const e = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(e * 255)));
  };
  return [
    encode(4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short),
    encode(-1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short),
    encode(-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short),
  ];
}

/** An opaque `oklch(L C H)` or `#rrggbb` as sRGB bytes. */
export function rgbOf(value: string): Rgb {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (hex) return [1, 2, 3].map((i) => Number.parseInt(hex[i], 16)) as Rgb;
  return srgb(oklab(value));
}

/** WCAG 2.x relative luminance and the (L1+0.05)/(L2+0.05) ratio. */
export function contrast(x: Rgb, y: Rgb): number {
  const luminance = (c: Rgb) => {
    const [r, g, b] = c.map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(x);
  const b = luminance(y);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** `value` painted over `surface`; default dark's `input` is white at an alpha. */
export function painted(value: string, surface: Rgb): Rgb {
  const m = /^(oklch\([^/]*?)\s*\/\s*([\d.]+)%\s*\)$/.exec(value);
  if (!m) return rgbOf(value);
  const alpha = Number(m[2]) / 100;
  const colour = rgbOf(`${m[1]})`);
  return colour.map((v, i) => v * alpha + surface[i] * (1 - alpha)) as Rgb;
}
