import { Button } from "@orz/ui/components/button";
import { cn } from "@orz/ui/lib/utils";
import { useTheme } from "@orz/ui/theme";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type DiagramPalette,
  type DiagramResult,
  errorSummary,
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
 * Mermaid source drawn as its diagram (T-523). `sourceView` shows until the
 * first render lands — the renderer is a lazy chunk — and stays one click
 * away afterwards. A diagram that does not parse keeps its source on screen
 * with the parser's complaint under it.
 *
 * The colors are the theme tokens in effect on this element. The diagram is
 * drawn again whenever `useTheme()` reports a new theme, color scheme or
 * variant; outside a ThemeProvider it keeps the colors present when it was
 * drawn.
 */
export function MermaidBlock({
  source,
  sourceView,
  className,
}: {
  source: string;
  /** Shown in place of the diagram. Default: a plain `<pre><code>`. */
  sourceView?: ReactNode;
  /** On the outer element, which also carries the probe the palette is read from. */
  className?: string;
}) {
  const { theme, colorScheme, variant } = useTheme();
  const probe = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<DiagramResult | null>(null);
  const [showSource, setShowSource] = useState(false);

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
  }, [source, theme, colorScheme, variant]);

  const diagram = result?.ok === true ? result : null;
  const sourceShown = sourceView ?? (
    <pre>
      <code>{source}</code>
    </pre>
  );
  return (
    // The toggle sits in a strip of its own: over the diagram it would cover
    // whichever node lands in the corner.
    <div
      ref={probe}
      className={cn(diagram === null ? undefined : "relative pt-7", className)}
    >
      {diagram !== null && !showSource ? (
        <div
          className="mermaid-diagram overflow-x-auto"
          style={{ "--diagram-width": `${diagram.width}px` } as CSSProperties}
          // mermaid's own output under securityLevel "strict", which runs
          // labels through DOMPurify: markup survives, scripts and handlers
          // do not.
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by mermaid, see above
          dangerouslySetInnerHTML={{ __html: diagram.svg }}
        />
      ) : (
        sourceShown
      )}
      {result?.ok === false && (
        <p
          className="mt-1 truncate text-destructive text-ui-sm"
          title={result.error}
        >
          {errorSummary(result.error)}
        </p>
      )}
      {diagram !== null && (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="absolute top-0 right-0"
          aria-pressed={showSource}
          onClick={() => setShowSource((shown) => !shown)}
        >
          {showSource ? "Diagram" : "Source"}
        </Button>
      )}
    </div>
  );
}
