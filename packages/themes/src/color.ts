/** OKLab through CSS Color 4's matrices, from `#rrggbb`. */
function oklab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
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

const round = (v: number, places: number) => Number(v.toFixed(places));

/**
 * `#rrggbb` as `oklch(L C H)` at the tokens' three decimals, which can land a
 * channel a step or two off the hex: for deriving values, not for restating a
 * published one.
 */
export function oklchOf(hex: string): string {
  const [l, a, b] = oklab(hex);
  const chroma = Math.hypot(a, b);
  const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return `oklch(${round(l, 3)} ${round(chroma, 3)} ${round(hue, 3)})`;
}

/** The neutral grey `#rrggbb` with the OKLab lightness of `hex`. */
export function grayOf(hex: string): string {
  // With a = b = 0 the three cone responses are equal, so linear R = G = B = L³.
  const linear = oklab(hex)[0] ** 3;
  const encoded =
    linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  const byte = Math.round(Math.min(1, Math.max(0, encoded)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${byte}${byte}${byte}`;
}
