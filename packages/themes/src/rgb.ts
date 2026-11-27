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

/** Linear-light sRGB through CSS Color 4's Oklab matrices, not clamped to the gamut. */
export function linearSrgb([lightness, a, b]: Lab): [number, number, number] {
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ];
}

/** CSS Color 4's Oklab matrices, then the sRGB transfer function. */
export function srgb(lab: Lab): Rgb {
  const encode = (v: number) => {
    const e = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(e * 255)));
  };
  return linearSrgb(lab).map(encode) as Rgb;
}

/** sRGB bytes as OKLab, through CSS Color 4's matrices. */
export function labOf(rgb: Rgb): Lab {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const long = Math.cbrt(
    0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
  );
  const medium = Math.cbrt(
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
  );
  const short = Math.cbrt(
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  );
  return [
    0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
    0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short,
  ];
}

/** How far apart two colours look: their distance in OKLab. */
export function distance(x: Rgb, y: Rgb): number {
  const [a, b] = [labOf(x), labOf(y)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
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
