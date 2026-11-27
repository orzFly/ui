import { ToolbarButton } from "@orz/ui/components/toolbar";
import { isPlainClick } from "@orz/ui/lib/link";
import { cn } from "@orz/ui/lib/utils";
import { Download } from "lucide-react";
import { type ComponentType, useState } from "react";
import {
  type FileLike,
  isAudioFile,
  isHtmlFile,
  isImageFile,
  isPdfFile,
  isVideoFile,
} from "../file-kind.ts";
import { useContentTitleBar } from "../title-bar.tsx";
import type {
  ContentProps,
  ContentRenderer,
  ContentSource,
  Placement,
} from "../types.ts";
import { ContentHeader } from "./content-frame.tsx";
import { fileIcon } from "./icon.ts";
import { ImageCanvas } from "./image-canvas.tsx";
import { AudioPlayer, VideoPlayer } from "./media-player.tsx";
import {
  type FileSource,
  useAttachmentViewer,
  useViewHref,
} from "./viewer.tsx";
import { useViewerImage } from "./viewer-image.ts";

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
 * Images, in either placement. In a document, under an attachment viewer,
 * the image is a link to the file whose plain click opens the viewer; outside
 * one it is a plain image. In the viewer it zooms and pans, with its controls
 * in the viewer's title bar.
 */
export function imageContent(): ContentRenderer {
  function ImageFile({ source, placement, className }: ContentProps) {
    const file = fileOf(source);
    const viewer = useAttachmentViewer();
    const viewHref = useViewHref(file);
    const viewerImage = useViewerImage();
    const titleBar = useContentTitleBar(source);
    if (
      placement === "viewer" &&
      viewerImage !== null &&
      titleBar !== undefined &&
      file.url !== undefined
    ) {
      return (
        <ImageCanvas
          src={file.url}
          alt={file.name}
          toolbar={titleBar}
          look={viewerImage.look}
          onLookChange={viewerImage.setLook}
          className={className}
        />
      );
    }
    if (placement === "viewer") {
      return (
        <img
          src={file.url}
          alt={file.name}
          className={cn(
            "mx-auto max-h-(--attachment-pane-height) rounded-item object-contain",
            className,
          )}
        />
      );
    }
    if (viewer === null) {
      return <img src={file.url} alt={file.name} className={className} />;
    }
    return (
      // A link to the file, as a thumbnail in `AttachmentList` is: Tab
      // reaches it, a modified click opens the file where the reader asked,
      // and the viewer hands the focus back to it on close (UI-249).
      <a
        href={viewHref}
        // A block the picture's width, as preflight draws a bare <img>: an
        // inline box would sit on a text line and add its gap below the
        // picture, and an inline link around a block draws no ring.
        className="block w-fit max-w-full outline-none focus-visible:focus-ring"
        onClick={(e) => {
          if (!isPlainClick(e)) return;
          e.preventDefault();
          viewer.show(file);
        }}
      >
        <img
          src={file.url}
          alt={file.name}
          className={cn("cursor-zoom-in", className)}
        />
      </a>
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
      // @orz/ui-mail's HTML body is the reverse, allow-same-origin without
      // allow-scripts: mail never needs a script, and the page measures it.
      <iframe
        src={options.src?.(file) ?? viewHref}
        sandbox="allow-scripts"
        title={file.name}
        className={cn(
          "h-(--attachment-pane-height) w-full rounded-item border bg-white",
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
          "h-(--attachment-pane-height) w-full rounded-item border",
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

const UNPLAYABLE = "This browser can't play this file.";

/** The name and Download over a player in a document; in the viewer the title bar has both. */
function MediaHeader({ file }: { file: FileSource }) {
  const Icon = fileIcon(file);
  return (
    <ContentHeader
      icon={<Icon />}
      name={<span title={file.name}>{file.name}</span>}
    >
      {file.url !== undefined && (
        <ToolbarButton
          asChild
          size="icon-xs"
          className="text-muted-foreground raymond:text-foreground"
        >
          <a
            href={file.url}
            download={file.name}
            aria-label="Download"
            title="Download"
          >
            <Download />
          </a>
        </ToolbarButton>
      )}
    </ContentHeader>
  );
}

type MediaFileProps = ContentProps & { Next: ComponentType<ContentProps> };

/** A file the browser cannot play still gets what the renderers after this one make of it. */
function Unplayable({ source, placement, className, Next }: MediaFileProps) {
  return (
    <div className={className}>
      <Next source={source} placement={placement} />
      <p className="text-muted-foreground text-ui-sm">{UNPLAYABLE}</p>
    </div>
  );
}

/** Video under the shared control bar, in either placement. */
export function videoContent(): ContentRenderer {
  function VideoFile(props: MediaFileProps) {
    const { source, placement, className } = props;
    const file = fileOf(source);
    const [failed, setFailed] = useState(false);
    if (failed) return <Unplayable {...props} />;
    return (
      <VideoPlayer
        src={file.url ?? ""}
        title={file.name}
        header={
          placement === "document" ? <MediaHeader file={file} /> : undefined
        }
        onError={() => setFailed(true)}
        className={cn(
          // The bar is 2.25rem tall; the picture takes the rest of the pane.
          placement === "viewer" &&
            "[&_video]:max-h-[calc(var(--attachment-pane-height)-2.25rem)]",
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

/** Audio under the shared control bar, in either placement. */
export function audioContent(): ContentRenderer {
  function AudioFile(props: MediaFileProps) {
    const { source, placement, className } = props;
    const file = fileOf(source);
    const [failed, setFailed] = useState(false);
    if (failed) return <Unplayable {...props} />;
    return (
      <AudioPlayer
        src={file.url ?? ""}
        title={file.name}
        header={
          placement === "document" ? <MediaHeader file={file} /> : undefined
        }
        onError={() => setFailed(true)}
        className={cn(placement === "viewer" && "w-full", className)}
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
