import { CodeBlock, CodeDiffBlock } from "@orz/ui-code";
import { useAttachmentViewer } from "@orz/ui-content/attachment";
import {
  type CompareSide,
  DEFAULT_COMPARE_LABELS,
  MediaCompare,
} from "@orz/ui-content/compare";
import { useMemo, useRef, useState } from "react";
import {
  DiagramDrawing,
  ErrorLine,
  OpenInViewer,
  SourceToggle,
} from "./diagram-parts.tsx";
import { colourChanges } from "./lib/mermaid-change.ts";
import type { DiagramResult } from "./render.ts";
import { useDiagram } from "./use-diagram.ts";

/**
 * Two versions of a mermaid diagram drawn side by side, what changed
 * coloured red on the older and green on the newer: a sequence diagram's
 * participants, messages and conditions, a flowchart's nodes and edges, and
 * for any other type the labels with no partner on the other side. Past half
 * the diagram changed, both draw plain.
 *
 * Until both renders are back, and when neither parses, it is the source
 * diff; Source switches to it and back. A side that does not parse shows its
 * error and its source. Within an `AttachmentViewerProvider` either picture,
 * or the toolbar, opens both in the viewer at one zoom.
 */
export function MermaidCompare({
  before,
  after,
  labels = DEFAULT_COMPARE_LABELS,
  title,
  className,
}: {
  /** The older version's source. */
  before: string;
  /** The newer version's source. */
  after: string;
  /** The sides' tags. Default: Before and After. */
  labels?: { before: string; after: string };
  /** A filename for the source, named at the head and in the viewer. */
  title?: string;
  className?: string;
}) {
  const probe = useRef<HTMLDivElement>(null);
  const old = useDiagram(probe, before);
  const next = useDiagram(probe, after);
  const [showSource, setShowSource] = useState(false);
  const viewer = useAttachmentViewer();

  // During render rather than in an effect: the colours have to arrive with
  // the diagrams, or they would paint one frame plain first.
  const marked = useMemo(
    () =>
      old?.ok === true && next?.ok === true
        ? colourChanges(old.svg, next.svg)
        : null,
    [old, next],
  );

  const filename = title ?? "diagram.mmd";
  const pending = old === null || next === null;
  const neither = old?.ok === false && next?.ok === false;
  const sourceDiff = (
    <CodeDiffBlock filename={filename} before={before} after={after} />
  );

  const side = (
    label: string,
    result: DiagramResult | null,
    source: string,
    svg: string | undefined,
  ): CompareSide =>
    result?.ok === true
      ? {
          label,
          size: { width: result.width, height: result.height },
          content: <DiagramDrawing svg={svg ?? result.svg} />,
        }
      : {
          label,
          size: null,
          failed: true,
          content: (
            <div className="grid gap-1.5 p-3">
              {result?.ok === false && (
                <ErrorLine error={result.error} className="border-t-0 px-0" />
              )}
              <CodeBlock
                filename={filename}
                contents={source}
                copy={false}
                bareFallback
              />
            </div>
          ),
        };

  const open =
    viewer === null || marked === null || old?.ok !== true || next?.ok !== true
      ? undefined
      : () =>
          viewer.openCompare(
            [
              {
                title: title ?? "Diagram",
                before: {
                  label: labels.before,
                  size: { width: old.width, height: old.height },
                  content: (
                    <DiagramDrawing svg={marked.before} className="size-full" />
                  ),
                },
                after: {
                  label: labels.after,
                  size: { width: next.width, height: next.height },
                  content: (
                    <DiagramDrawing svg={marked.after} className="size-full" />
                  ),
                },
              },
            ],
            0,
          );

  return (
    // The palette is read in here, off the colours the comparison paints.
    <div ref={probe} className={className}>
      <MediaCompare
        before={side(labels.before, old, before, marked?.before)}
        after={side(labels.after, next, after, marked?.after)}
        modes={["2up"]}
        align="center"
        backdrop="page"
        title={title}
        onOpen={open}
        actions={
          !pending &&
          !neither && (
            <>
              <SourceToggle
                shown={showSource}
                onToggle={() => setShowSource((shown) => !shown)}
              />
              {open !== undefined && <OpenInViewer onOpen={open} />}
            </>
          )
        }
        replacement={
          pending || showSource ? (
            sourceDiff
          ) : neither ? (
            <>
              {sourceDiff}
              {next?.ok === false && <ErrorLine error={next.error} />}
            </>
          ) : undefined
        }
      />
    </div>
  );
}
