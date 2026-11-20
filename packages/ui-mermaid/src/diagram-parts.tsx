import { ToolbarButton } from "@orz/ui/components/toolbar";
import { cn } from "@orz/ui/lib/utils";
import { Maximize2Icon } from "lucide-react";
import { errorSummary } from "./render.ts";

/**
 * A rendered diagram's SVG at the width of its box, its height following:
 * in a comparison's side, the box the comparison sizes; in the viewer, the
 * box at the diagram's natural size that the zoom transforms. A span, so it
 * may sit in the button a comparison opens the viewer with.
 */
export function DiagramDrawing({
  svg,
  className,
}: {
  svg: string;
  className?: string;
}) {
  return (
    <span
      className={cn("mermaid-drawing block", className)}
      // mermaid's own output under securityLevel "strict", which runs labels
      // through DOMPurify: markup survives, scripts and handlers do not. The
      // colours a comparison adds are styles and rects set here.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by mermaid, see above
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Opens what the block draws in the attachment viewer. */
export function OpenInViewer({ onOpen }: { onOpen(): void }) {
  return (
    <ToolbarButton
      type="button"
      size="icon-xs"
      aria-label="Open in the viewer"
      title="Open in the viewer"
      className="text-muted-foreground"
      onClick={onOpen}
    >
      <Maximize2Icon />
    </ToolbarButton>
  );
}

/** Swaps the drawing for its source and back; the reader's only way to the source. */
export function SourceToggle({
  shown,
  onToggle,
}: {
  shown: boolean;
  onToggle(): void;
}) {
  return (
    <ToolbarButton
      type="button"
      size="xs"
      className="font-normal text-muted-foreground"
      aria-pressed={shown}
      onClick={onToggle}
    >
      {shown ? "Diagram" : "Source"}
    </ToolbarButton>
  );
}

/** The parser's complaint, cut to the line that says where and what. */
export function ErrorLine({
  error,
  className,
}: {
  error: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "truncate border-t px-3 py-1 text-destructive text-ui-sm",
        className,
      )}
      title={error}
    >
      {errorSummary(error)}
    </p>
  );
}
