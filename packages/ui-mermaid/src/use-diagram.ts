import { useTheme } from "@orz/ui/theme";
import { type RefObject, useEffect, useState } from "react";
import {
  type DiagramPalette,
  type DiagramResult,
  renderDiagram,
} from "./render.ts";

let canvas: CanvasRenderingContext2D | null | undefined;

/**
 * Any CSS color → `#rrggbb`, composited over `under` so translucent tokens
 * (the dark themes' borders) come out as the color they actually paint.
 */
function toHex(color: string, under: string): string {
  canvas ??= document.createElement("canvas").getContext("2d", {
    willReadFrequently: true,
  });
  if (canvas == null) return color;
  canvas.clearRect(0, 0, 1, 1);
  canvas.fillStyle = under;
  canvas.fillRect(0, 0, 1, 1);
  canvas.fillStyle = color;
  canvas.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = canvas.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance of a `#rrggbb` color. */
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) => {
    const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function readPalette(el: Element): DiagramPalette {
  const style = getComputedStyle(el);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const background = toHex(token("--background") || "#fff", "#fff");
  const hex = (name: string) => toHex(token(name), background);
  return {
    // Read off the painted background rather than `.dark` on <html>: the
    // theme root can be any element, and there may be no ThemeProvider at all.
    dark: luminance(background) < 0.5,
    background,
    foreground: hex("--foreground"),
    muted: hex("--muted"),
    mutedForeground: hex("--muted-foreground"),
    border: hex("--border"),
  };
}

/**
 * `source` drawn in the theme tokens and font in effect on `probe`, again
 * whenever `useTheme()` reports a new theme, color scheme or variant; null
 * until the first render is back.
 */
export function useDiagram(
  probe: RefObject<HTMLElement | null>,
  source: string,
): DiagramResult | null {
  const { theme, colorScheme, variant } = useTheme();
  const [result, setResult] = useState<DiagramResult | null>(null);

  useEffect(() => {
    // Read only as a trigger: the colors come off the computed style below,
    // which the store has already switched by the time it notifies.
    void [theme, colorScheme, variant];
    const el = probe.current;
    if (el === null) return;
    let live = true;
    renderDiagram(
      source,
      readPalette(el),
      getComputedStyle(el).fontFamily,
    ).then((next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
    };
  }, [probe, source, theme, colorScheme, variant]);

  return result;
}
