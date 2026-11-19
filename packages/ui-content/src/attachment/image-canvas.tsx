import { cn } from "@orz/ui/lib/utils";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { ImageLook } from "./image-look.ts";
import { fitScale } from "./image-zoom.ts";
import { releaseWidth, useZoomPan, type Widening } from "./use-zoom-pan.ts";
import { ZoomControls } from "./zoom-controls.tsx";

// In screen pixels, never scaled with the image: at 800% a scaled checker
// would be squares bigger than the pixels it is meant to show through.
export const CHECKER =
  "repeating-conic-gradient(#d4d4d4 0 25%, #fff 0 50%) 0 0 / 16px 16px";

/** A fitted picture's corner, and its checkerboard's. */
export const CORNER = "min(var(--radius-item), 6px)";

/**
 * The attachment viewer's image: wheel or pinch zooms about the pointer, drag
 * pans, a click toggles fit ↔ actual pixels, and − 100%▾ + sit in the
 * viewer's title bar, the readout opening fit, 100% and the background and
 * scaling choices. Mount it keyed by the image so paging starts every image
 * at fit; `lastHeight` carries the canvas height across that remount, so the
 * next image tweens from it. While `held` is set the canvas keeps that height
 * whatever the zoom or image asks for, and moves to its own once it is
 * cleared. Zoomed in, it widens `dialog` with it, `widening` carrying that
 * across paging.
 */
export function ImageCanvas({
  src,
  alt,
  maximized,
  toolbar,
  look,
  onLookChange,
  lastHeight,
  held,
  dialog,
  widening,
  className,
}: {
  src: string;
  alt: string;
  maximized: boolean;
  toolbar: HTMLElement | null;
  look: ImageLook;
  onLookChange(look: ImageLook): void;
  lastHeight: { current: number | null };
  held: number | null;
  dialog: HTMLElement | null;
  widening: { current: Widening };
  className?: string;
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const {
    canvasRef,
    frame,
    view,
    fitted,
    dragging,
    height,
    atCentre,
    step,
    handlers,
  } = useZoomPan({
    natural,
    maximized,
    lastHeight,
    held,
    dialog,
    widening,
  });

  // Nothing to measure or zoom; the static image's alt text and
  // broken-image icon are the error.
  if (failed) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn(
          "mx-auto max-h-(--attachment-pane-height) rounded-item object-contain",
          className,
        )}
      />
    );
  }

  return (
    <>
      {toolbar !== null &&
        createPortal(
          <ZoomControls
            frame={frame}
            view={view}
            atCentre={atCentre}
            step={step}
            look={look}
            onLookChange={onLookChange}
          />,
          toolbar,
        )}
      <div
        ref={canvasRef}
        data-testid="image-canvas"
        data-zoom={view === null ? undefined : view.z.toFixed(4)}
        data-fit={frame === null ? undefined : fitScale(frame).toFixed(4)}
        className={cn(
          "relative touch-none overflow-hidden select-none",
          look.background === "black" && "bg-black",
          maximized ? "h-full" : "max-h-(--attachment-pane-height) min-h-24",
          fitted
            ? "cursor-zoom-in"
            : dragging
              ? "cursor-grabbing"
              : "cursor-grab",
          className,
        )}
        style={height === undefined ? undefined : { height }}
        {...handlers}
      >
        {look.background === "checker" && natural !== null && view !== null && (
          // Under the image only, so the letterbox still shows where the
          // image ends; black, by contrast, fills the canvas.
          <div
            aria-hidden
            data-testid="image-checker"
            className="absolute"
            style={{
              left: view.x,
              top: view.y,
              width: natural.w * view.z,
              height: natural.h * view.z,
              background: CHECKER,
              borderRadius: fitted ? CORNER : 0,
            }}
          />
        )}
        <img
          src={src}
          alt={alt}
          draggable={false}
          onError={() => {
            lastHeight.current = null;
            releaseWidth(dialog, widening);
            setFailed(true);
          }}
          onLoad={(e) =>
            setNatural({
              w: e.currentTarget.naturalWidth,
              h: e.currentTarget.naturalHeight,
            })
          }
          className={cn(
            "absolute top-0 left-0 max-w-none origin-top-left",
            view === null && "invisible",
          )}
          style={
            natural === null || view === null
              ? undefined
              : {
                  width: natural.w,
                  height: natural.h,
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
                  // A static image's corner, divided back out of the
                  // scale; zoomed in, a rounded corner would read as the
                  // image's own edge.
                  borderRadius: fitted ? `calc(${CORNER} / ${view.z})` : 0,
                  // Shrunk, nearest-neighbour drops whole rows and columns;
                  // pixelated only means something once an image pixel is
                  // bigger than a screen pixel.
                  imageRendering:
                    look.smoothing === "pixelated" && view.z > 1
                      ? "pixelated"
                      : undefined,
                }
          }
        />
      </div>
    </>
  );
}
