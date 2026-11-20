import { ZoomCanvas } from "@orz/ui-content/attachment";
import { type ReactNode, useRef } from "react";
import { DiagramDrawing, ErrorLine } from "./diagram-parts.tsx";
import { useDiagram } from "./use-diagram.ts";

/**
 * One diagram in the attachment viewer, zoomed and panned as an image is
 * and redrawn as vectors at every zoom. Until it is drawn the canvas is
 * empty; a source that does not parse shows `sourceView` and the parser's
 * complaint instead.
 */
export function MermaidCanvas({
  source,
  toolbar,
  sourceView,
  className,
}: {
  source: string;
  /** The title-bar slot the viewer lends, for − 100%▾ +. */
  toolbar: HTMLElement | null;
  sourceView: ReactNode;
  className?: string;
}) {
  const probe = useRef<HTMLDivElement>(null);
  const result = useDiagram(probe, source);
  return (
    // `contents`, so the canvas still fills the viewer's pane; the palette
    // is read off it all the same, custom properties being inherited.
    <div ref={probe} className="contents">
      {result?.ok === false ? (
        <div className={className}>
          {sourceView}
          <ErrorLine error={result.error} />
        </div>
      ) : (
        <ZoomCanvas
          size={
            result === null
              ? null
              : { width: result.width, height: result.height }
          }
          toolbar={toolbar}
          className={className}
          data-testid="diagram-canvas"
        >
          {result !== null && (
            <DiagramDrawing svg={result.svg} className="size-full" />
          )}
        </ZoomCanvas>
      )}
    </div>
  );
}
