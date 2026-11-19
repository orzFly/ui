import { cn } from "@orz/ui/lib/utils";
import { useState } from "react";
import type { ImageLook } from "./image-look.ts";
import { releaseWidth } from "./use-zoom-pan.ts";
import { useViewerImage } from "./viewer-image.ts";
import { ZoomCanvas } from "./zoom-canvas.tsx";

/**
 * The attachment viewer's image: a ZoomCanvas over an `<img>`, sized when it
 * loads, with the background and scaling choices in its zoom menu. Mount it
 * keyed by the image so paging starts every image at fit. An image that
 * fails to load is drawn as the browser draws it, its alt text and
 * broken-image icon being the error.
 */
export function ImageCanvas({
  src,
  alt,
  toolbar,
  look,
  onLookChange,
  className,
}: {
  src: string;
  alt: string;
  toolbar: HTMLElement | null;
  look: ImageLook;
  onLookChange(look: ImageLook): void;
  className?: string;
}) {
  const viewer = useViewerImage();
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);

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
    <ZoomCanvas
      size={size}
      toolbar={toolbar}
      look={look}
      onLookChange={onLookChange}
      className={className}
      data-testid="image-canvas"
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        onError={() => {
          // Nothing to measure: back to the size a body that does not zoom
          // has, at once.
          if (viewer !== null) {
            viewer.lastHeight.current = null;
            releaseWidth(viewer.dialog, viewer.widening);
          }
          setFailed(true);
        }}
        onLoad={(e) =>
          setSize({
            width: e.currentTarget.naturalWidth,
            height: e.currentTarget.naturalHeight,
          })
        }
      />
    </ZoomCanvas>
  );
}
