import { afterEach, describe, expect, it, vi } from "vitest";
import { segmentMetrics } from "../src/lib/text-metrics.ts";

// Happy-dom has no canvas, and its computed style leaves the font enums empty.
// The stand-ins answer as Chromium does: computed style gives `font-stretch`
// as a percentage, and a canvas setter ignores a value outside its enum.
const CANVAS_ENUMS = {
  fontKerning: ["auto", "normal", "none"],
  fontStretch: [
    "ultra-condensed",
    "extra-condensed",
    "condensed",
    "semi-condensed",
    "normal",
    "semi-expanded",
    "expanded",
    "extra-expanded",
    "ultra-expanded",
  ],
  fontVariantCaps: [
    "normal",
    "small-caps",
    "all-small-caps",
    "petite-caps",
    "all-petite-caps",
    "unicase",
    "titling-caps",
  ],
  textRendering: [
    "auto",
    "optimizeSpeed",
    "optimizeLegibility",
    "geometricPrecision",
  ],
} as const;

/**
 * Each character advances by the font size the canvas holds, so text measured
 * in canvas's default font comes out at 10px a character.
 */
function strictContext(rejected: string[]) {
  const values: Record<string, string> = {
    font: "10px sans-serif",
    fontKerning: "auto",
    fontStretch: "normal",
    fontVariantCaps: "normal",
    textRendering: "auto",
  };
  const context: Record<string, unknown> = {
    letterSpacing: "0px",
    wordSpacing: "0px",
    measureText: (text: string) => {
      const size = Number.parseFloat(values.font.match(/[\d.]+px/)?.[0] ?? "");
      return { width: [...text].length * size };
    },
  };
  // Canvas keeps its current font when the new one does not parse.
  Object.defineProperty(context, "font", {
    get: () => values.font,
    set: (value: string) => {
      if (value) values.font = value;
    },
  });
  for (const [name, allowed] of Object.entries(CANVAS_ENUMS)) {
    Object.defineProperty(context, name, {
      get: () => values[name],
      set: (value: string) => {
        if ((allowed as readonly string[]).includes(value))
          values[name] = value;
        else rejected.push(`${name} = ${JSON.stringify(value)}`);
      },
    });
  }
  return context;
}

const STYLE = {
  font: "16px Probe",
  fontStyle: "normal",
  fontWeight: "400",
  fontSize: "16px",
  fontFamily: "Probe",
  fontKerning: "auto",
  fontStretch: "100%",
  fontVariantCaps: "normal",
  textRendering: "auto",
  letterSpacing: "normal",
  wordSpacing: "normal",
};

function stubBrowser(style: Partial<typeof STYLE> = {}) {
  const rejected: string[] = [];
  const context = strictContext(rejected);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    ...STYLE,
    ...style,
  } as CSSStyleDeclaration);
  return { context, rejected };
}

function probe(text = "abcdefgh") {
  const element = document.createElement("span");
  element.textContent = text;
  return element;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("segmentMetrics", () => {
  it("sets nothing on the canvas that it rejects", () => {
    const { context, rejected } = stubBrowser();

    const metrics = segmentMetrics(probe());

    expect(rejected).toEqual([]);
    expect(context.font).toBe("16px Probe");
    expect(metrics).toEqual({
      full: 8 * 16,
      minimum: 3 * 16,
      tailWidth: 16,
      threeWidth: 7 * 16,
      tailThreeWidth: 3 * 16,
    });
  });
});

// What Chromium 156 and Firefox 153 compute for an element whose font the
// shorthand cannot spell (`tabular-nums`, say): `font` is "", and only the
// longhands still carry it.
const UNSPELLED = {
  font: "",
  fontStyle: "italic",
  fontWeight: "500",
  fontSize: "14px",
  fontFamily: '"Noto Sans Variable", sans-serif',
};

describe("segmentMetrics where the computed font shorthand is empty", () => {
  it("measures in the element's own size and family", () => {
    const { context, rejected } = stubBrowser(UNSPELLED);

    const metrics = segmentMetrics(probe("1234"));

    expect(metrics.full).toBe(4 * 14);
    expect(context.font).toBe(
      'italic 500 14px "Noto Sans Variable", sans-serif',
    );
    expect(rejected).toEqual([]);
  });

  it.each([
    { fontStretch: "40%", keyword: "ultra-condensed" },
    { fontStretch: "50%", keyword: "ultra-condensed" },
    { fontStretch: "80%", keyword: "condensed" },
    { fontStretch: "95%", keyword: "semi-condensed" },
    { fontStretch: "100%", keyword: null },
    { fontStretch: "105%", keyword: "semi-expanded" },
    { fontStretch: "120%", keyword: "expanded" },
    { fontStretch: "250%", keyword: "ultra-expanded" },
  ])(
    "names a $fontStretch width by the keyword away from normal: $keyword",
    ({ fontStretch, keyword }) => {
      const { context } = stubBrowser({
        ...UNSPELLED,
        fontStyle: "normal",
        fontWeight: "400",
        fontStretch,
        fontFamily: "Probe",
      });

      segmentMetrics(probe());

      expect(context.font).toBe(
        ["400", keyword, "14px Probe"].filter(Boolean).join(" "),
      );
    },
  );
});
