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

const CHAR_WIDTH = 8;

function strictContext(rejected: string[]) {
  const values: Record<string, string> = {
    fontKerning: "auto",
    fontStretch: "normal",
    fontVariantCaps: "normal",
    textRendering: "auto",
  };
  const context: Record<string, unknown> = {
    font: "10px sans-serif",
    letterSpacing: "0px",
    wordSpacing: "0px",
    measureText: (text: string) => ({ width: [...text].length * CHAR_WIDTH }),
  };
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

function stubBrowser() {
  const rejected: string[] = [];
  const context = strictContext(rejected);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    font: "16px Probe",
    fontSize: "16px",
    fontKerning: "auto",
    fontStretch: "100%",
    fontVariantCaps: "normal",
    textRendering: "auto",
    letterSpacing: "normal",
    wordSpacing: "normal",
  } as CSSStyleDeclaration);
  return { context, rejected };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("segmentMetrics", () => {
  it("sets nothing on the canvas that it rejects", () => {
    const { context, rejected } = stubBrowser();
    const element = document.createElement("span");
    element.textContent = "abcdefgh";

    const metrics = segmentMetrics(element);

    expect(rejected).toEqual([]);
    expect(context.font).toBe("16px Probe");
    expect(metrics).toEqual({
      full: 8 * CHAR_WIDTH,
      minimum: 3 * CHAR_WIDTH,
      tailWidth: CHAR_WIDTH,
      threeWidth: 7 * CHAR_WIDTH,
      tailThreeWidth: 3 * CHAR_WIDTH,
    });
  });
});
