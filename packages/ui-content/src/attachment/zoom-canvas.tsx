import { cn } from "@orz/ui/lib/utils";
import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { ImageLook } from "./image-look.ts";
import { fitScale } from "./image-zoom.ts";
import { useZoomPan } from "./use-zoom-pan.ts";
import { useViewerImage } from "./viewer-image.ts";
import { ZoomControls } from "./zoom-controls.tsx";

// In screen pixels, never scaled with the image: at 800% a scaled checker
// would be squares bigger than the pixels it is meant to show through.
export const CHECKER =
  "repeating-conic-gradient(#d4d4d4 0 25%, #fff 0 50%) 0 0 / 16px 16px";

/** A fitted picture's corner, and its checkerboard's. */
export const CORNER = "min(var(--radius-item), 6px)";

export type ZoomCanvasProps = {
  /** The picture's natural size in px; null until it is known, which shows nothing yet. */
  size: { width: number; height: number } | null;
  /**
   * The picture, laid out at its natural size from the top-left: an `<img>`
   * that fills its box, or a drawn node such as an SVG, which the browser
   * redraws as vectors at any zoom.
   */
  children: ReactNode;
  /** Where − 100%▾ + go, as `useContentTitleBar` gives it; null or undefined draws none. */
  toolbar: HTMLElement | null | undefined;
  /**
   * An image's background and scaling, offered in the zoom menu; leave out
   * for a picture with its own ground.
   */
  look?: ImageLook;
  onLookChange?(look: ImageLook): void;
  className?: string;
  "data-testid"?: string;
};

/**
 * A picture the attachment viewer zooms and pans: wheel or pinch zooms about
 * the pointer, pausing at contain, cover and 100%, drag pans, a click toggles
 * fit ↔ actual pixels, and − 100%▾ + sit in the viewer's title bar. Restored,
 * the viewer grows with the zoom, taller and then wider. A renderer draws it
 * in `"viewer"` placement; mount it keyed by the picture, so paging starts
 * the next at fit. Outside a viewer it zooms in a box of its own.
 */
export function ZoomCanvas({
  size,
  children,
  toolbar,
  look,
  onLookChange,
  className,
  "data-testid": testId,
}: ZoomCanvasProps) {
  const viewer = useViewerImage();
  const ownHeight = useRef<number | null>(null);
  const maximized = viewer?.maximized ?? false;
  const width = size?.width;
  const height = size?.height;
  const natural = useMemo(
    () =>
      width === undefined || height === undefined
        ? null
        : { w: width, h: height },
    [width, height],
  );
  const zoom = useZoomPan({
    natural,
    maximized,
    lastHeight: viewer?.lastHeight ?? ownHeight,
    held: viewer?.held ?? null,
    dialog: viewer?.dialog ?? null,
    widening: viewer?.widening,
  });
  const { frame, view, fitted, dragging } = zoom;
  // Tells the viewer a canvas holds its size, so it does not give the width
  // back as it does for a body that does not zoom.
  const canvases = viewer?.canvases;
  useLayoutEffect(() => {
    if (canvases === undefined) return;
    canvases.current++;
    return () => {
      canvases.current--;
    };
  }, [canvases]);

  return (
    <>
      {toolbar != null &&
        createPortal(
          <ZoomControls
            frame={frame}
            view={view}
            atCentre={zoom.atCentre}
            step={zoom.step}
            look={look}
            onLookChange={onLookChange}
          />,
          toolbar,
        )}
      <div
        ref={zoom.canvasRef}
        data-slot="zoom-canvas"
        data-testid={testId}
        data-zoom={view === null ? undefined : view.z.toFixed(4)}
        data-fit={frame === null ? undefined : fitScale(frame).toFixed(4)}
        className={cn(
          "relative touch-none overflow-hidden select-none",
          look?.background === "black" && "bg-black",
          maximized ? "h-full" : "max-h-(--attachment-pane-height) min-h-24",
          fitted
            ? "cursor-zoom-in"
            : dragging
              ? "cursor-grabbing"
              : "cursor-grab",
          className,
        )}
        style={zoom.height === undefined ? undefined : { height: zoom.height }}
        {...zoom.handlers}
      >
        {look?.background === "checker" && size !== null && view !== null && (
          // Under the picture only, so the letterbox still shows where it
          // ends; black, by contrast, fills the canvas.
          <div
            aria-hidden
            data-testid="image-checker"
            className="absolute"
            style={{
              left: view.x,
              top: view.y,
              width: size.width * view.z,
              height: size.height * view.z,
              background: CHECKER,
              borderRadius: fitted ? CORNER : 0,
            }}
          />
        )}
        <div
          data-slot="zoom-canvas-picture"
          className={cn(
            "absolute top-0 left-0 origin-top-left overflow-clip [&>img]:block [&>img]:size-full [&>img]:max-w-none",
            view === null && "invisible",
          )}
          style={
            size === null || view === null
              ? undefined
              : {
                  width: size.width,
                  height: size.height,
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
                  // A static picture's corner, divided back out of the
                  // scale; zoomed in, a rounded corner would read as the
                  // picture's own edge.
                  borderRadius: fitted ? `calc(${CORNER} / ${view.z})` : 0,
                  // Shrunk, nearest-neighbour drops whole rows and columns;
                  // pixelated only means something once an image pixel is
                  // bigger than a screen pixel. Inherited by the image.
                  imageRendering:
                    look?.smoothing === "pixelated" && view.z > 1
                      ? "pixelated"
                      : undefined,
                }
          }
        >
          {children}
        </div>
      </div>
    </>
  );
}
