import { cn } from "@orz/ui/lib/utils";
import {
  type FileLike,
  isAudioFile,
  isHtmlFile,
  isImageFile,
  isPdfFile,
  isVideoFile,
} from "../file-kind.ts";
import type {
  ContentProps,
  ContentRenderer,
  ContentSource,
  Placement,
} from "../types.ts";
import {
  type FileSource,
  useAttachmentViewer,
  useViewHref,
} from "./viewer.tsx";

export type FrameContentOptions = {
  /** Where the frame loads the file from. Default: the provider's `viewHref`, else `url`. */
  src?: (file: FileSource) => string;
};

function acceptsFile(
  kind: (file: FileLike) => boolean,
  placements: readonly Placement[],
) {
  return (source: ContentSource, placement: Placement) =>
    source.kind === "file" &&
    source.url !== undefined &&
    placements.includes(placement) &&
    kind(source);
}

const BOTH: readonly Placement[] = ["document", "viewer"];
const VIEWER: readonly Placement[] = ["viewer"];

/** Every renderer here accepts only files, so `Component` only ever sees one. */
function fileOf(source: ContentSource): FileSource {
  if (source.kind !== "file") throw new Error("expected a file source");
  return source;
}

/**
 * Images, in either placement. In a document the image opens the nearest
 * attachment viewer on click, and is a plain image outside one.
 */
export function imageContent(): ContentRenderer {
  function ImageFile({ source, placement, className }: ContentProps) {
    const file = fileOf(source);
    const viewer = useAttachmentViewer();
    if (placement === "viewer") {
      return (
        <img
          src={file.url}
          alt={file.name}
          className={cn(
            "mx-auto max-h-(--attachment-pane-height) rounded-md object-contain",
            className,
          )}
        />
      );
    }
    if (viewer === null) {
      return <img src={file.url} alt={file.name} className={className} />;
    }
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: zoom is a mouse affordance; the viewer dialog's links stay keyboard-reachable
      <img
        src={file.url}
        alt={file.name}
        className={cn("cursor-zoom-in", className)}
        onClick={() => viewer.show(file)}
      />
    );
  }

  return {
    name: "image",
    accepts: acceptsFile(isImageFile, BOTH),
    display: "inline",
    Component: ImageFile,
  };
}

/** HTML files, sandboxed, in the viewer. In a document they are text, and `attachmentCard`'s. */
export function htmlContent(
  options: FrameContentOptions = {},
): ContentRenderer {
  function HtmlFile({ source, className }: ContentProps) {
    const file = fileOf(source);
    const viewHref = useViewHref(file);
    return (
      // Never add allow-same-origin: a file served from the app's own origin
      // could then run scripts that call the app's API with the reader's
      // cookies. allow-scripts alone keeps the document on an opaque origin.
      <iframe
        src={options.src?.(file) ?? viewHref}
        sandbox="allow-scripts"
        title={file.name}
        className={cn(
          "h-(--attachment-pane-height) w-full rounded-md border bg-white",
          className,
        )}
      />
    );
  }

  return {
    name: "html",
    accepts: acceptsFile(isHtmlFile, VIEWER),
    display: "block",
    Component: HtmlFile,
  };
}

/** PDFs, in the browser's own viewer. Not offered in documents. */
export function pdfContent(options: FrameContentOptions = {}): ContentRenderer {
  function PdfFile({ source, className }: ContentProps) {
    const file = fileOf(source);
    const viewHref = useViewHref(file);
    return (
      // No sandbox: Chromium's PDF viewer refuses to run in a sandboxed frame.
      <iframe
        src={options.src?.(file) ?? viewHref}
        title={file.name}
        className={cn(
          "h-(--attachment-pane-height) w-full rounded-md border",
          className,
        )}
      />
    );
  }

  return {
    name: "pdf",
    accepts: acceptsFile(isPdfFile, VIEWER),
    display: "block",
    Component: PdfFile,
  };
}

/** Video with native controls, in either placement. */
export function videoContent(): ContentRenderer {
  function VideoFile({ source, placement, className }: ContentProps) {
    const file = fileOf(source);
    return (
      // preload="metadata": a page of embeds must not download every file.
      // biome-ignore lint/a11y/useMediaCaption: an uploaded file carries no caption track to offer
      <video
        src={file.url}
        controls
        preload="metadata"
        title={file.name}
        className={cn(
          "max-w-full rounded-md",
          placement === "viewer" && "mx-auto max-h-(--attachment-pane-height)",
          className,
        )}
      />
    );
  }

  return {
    name: "video",
    accepts: acceptsFile(isVideoFile, BOTH),
    display: "block",
    Component: VideoFile,
  };
}

/** Audio with native controls, in either placement. */
export function audioContent(): ContentRenderer {
  function AudioFile({ source, placement, className }: ContentProps) {
    const file = fileOf(source);
    return (
      // biome-ignore lint/a11y/useMediaCaption: an uploaded file carries no caption track to offer
      <audio
        src={file.url}
        controls
        preload="metadata"
        title={file.name}
        className={cn(
          placement === "viewer" ? "w-full" : "my-2 block max-w-full",
          className,
        )}
      />
    );
  }

  return {
    name: "audio",
    accepts: acceptsFile(isAudioFile, BOTH),
    display: "block",
    Component: AudioFile,
  };
}
