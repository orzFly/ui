import { FenceFrame } from "@orz/ui-code";
import {
  useAttachmentViewer,
  useViewerImage,
} from "@orz/ui-content/attachment";
import { type CSSProperties, type ReactNode, useRef, useState } from "react";
import { ErrorLine, OpenInViewer, SourceToggle } from "./diagram-parts.tsx";
import { useDiagram } from "./use-diagram.ts";

/**
 * Mermaid source drawn as its diagram (T-523), in a code block's frame
 * (`FenceFrame`) with Copy. `sourceView` shows until the first render lands
 * — the renderer is a lazy chunk — and stays one click away afterwards, from
 * a toolbar that never hides, since it is the only way to the source. A
 * diagram that does not parse keeps its source on screen with the parser's
 * complaint under it. Within an `AttachmentViewerProvider` the toolbar also
 * opens the diagram in the viewer, where `mermaidContent` zooms it.
 *
 * The colors are the theme tokens in effect on this element. The diagram is
 * drawn again whenever `useTheme()` reports a new theme, color scheme or
 * variant; outside a ThemeProvider it keeps the colors present when it was
 * drawn.
 */
export function MermaidBlock({
  source,
  sourceView,
  title,
  collapsible = false,
  className,
}: {
  source: string;
  /**
   * Shown in place of the diagram, inside the frame. Default: a plain `<pre><code>`. A code view
   * there reads `useInFenceFrame` and leaves the frame and Copy to this block.
   */
  sourceView?: ReactNode;
  /** A filename for the source, which the frame's header offers as a download. */
  title?: string;
  /** Cuts the source shown at the shared cap, behind Show all; never the drawn diagram. */
  collapsible?: boolean;
  /** On the frame. */
  className?: string;
}) {
  const probe = useRef<HTMLDivElement>(null);
  const result = useDiagram(probe, source);
  const [showSource, setShowSource] = useState(false);
  const viewer = useAttachmentViewer();
  // Already in the viewer, the block is what it would open.
  const inViewer = useViewerImage() !== null;

  const diagram = result?.ok === true ? result : null;
  const drawn = diagram !== null && !showSource;
  const sourceShown = sourceView ?? (
    <pre className="m-0 overflow-x-auto rounded-none bg-transparent p-3 raymond:shadow-none">
      <code>{source}</code>
    </pre>
  );
  return (
    <FenceFrame
      text={source}
      title={title}
      collapsible={collapsible && !drawn}
      toolbarAlwaysVisible={diagram !== null}
      actions={
        diagram !== null && (
          <>
            <SourceToggle
              shown={showSource}
              onToggle={() => setShowSource((shown) => !shown)}
            />
            {viewer !== null && !inViewer && (
              <OpenInViewer
                onOpen={() =>
                  viewer.open(
                    [
                      {
                        kind: "inline",
                        text: source,
                        lang: "mermaid",
                        title: title ?? "Diagram",
                      },
                    ],
                    0,
                  )
                }
              />
            )}
          </>
        )
      }
      className={className}
    >
      {/* The palette is read in here, off the colours the frame paints. */}
      <div ref={probe}>
        {drawn ? (
          <div
            className="mermaid-diagram overflow-x-auto p-4"
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
        {result?.ok === false && <ErrorLine error={result.error} />}
      </div>
    </FenceFrame>
  );
}
