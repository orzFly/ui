import { type ComponentType, useState } from "react";
import { formatSize, isTextEmbed, textPreviewGate } from "../file-kind.ts";
import { useContentDepth, useContentMaxDepth } from "../registry.tsx";
import type { ContentProps, ContentRenderer } from "../types.ts";
import { DocumentCard } from "./document-card.tsx";
import { AttachmentLink } from "./link.tsx";
import {
  type FileSource,
  useAttachmentViewer,
  useCanPreview,
} from "./viewer.tsx";

export type AttachmentCardOptions = {
  /**
   * Text files above this wait for "Preview anyway", and the renderer then draws them plain.
   * Default 1 MiB.
   */
  maxBytes?: number;
  /** Text files above this draw a note instead of their contents. Default 10 MiB. */
  hardMaxBytes?: number;
  /**
   * How many embedded files deep a card is still drawn; past it, the file is a link chip.
   * Defaults to the provider's `maxDepth`, else 1, as `markdownContent` counts it, so the two
   * agree on which level turns into a link.
   */
  maxDepth?: number;
  /** Height cap for the card's collapsed body. Default `max-h-80`. */
  collapsedClassName?: string;
};

/**
 * Frames a text file embedded in a document: a `DocumentCard` whose body is drawn by the
 * renderers after this one. Register it first, so a text embed is framed before anything draws it.
 *
 * Returns a new renderer on every call, so call it once, where the renderer list is built.
 */
export function attachmentCard(
  options: AttachmentCardOptions = {},
): ContentRenderer {
  const limits = { max: options.maxBytes, hardMax: options.hardMaxBytes };

  function AttachmentCard({
    source,
    className,
    Next,
  }: ContentProps & { Next: ComponentType<ContentProps> }) {
    const depth = useContentDepth();
    const providerMaxDepth = useContentMaxDepth();
    const viewer = useAttachmentViewer();
    const canPreview = useCanPreview(source as FileSource);
    const [asked, setAsked] = useState(false);
    if (source.kind !== "file") return null;
    const maxDepth = options.maxDepth ?? providerMaxDepth ?? 1;
    // A document inside a document card shows its own documents as links,
    // which is what stops a document that embeds itself.
    if (depth > maxDepth) {
      return <AttachmentLink file={source} className={className} />;
    }
    const meta =
      source.size === undefined ? undefined : formatSize(source.size);
    const gate =
      source.size === undefined
        ? "auto"
        : textPreviewGate({ ...source, size: source.size }, limits);
    if (gate === "refuse" || (gate === "ask" && !asked)) {
      return (
        <DocumentCard
          name={source.name}
          meta={meta}
          downloadUrl={source.url}
          className={className}
          collapsedClassName={options.collapsedClassName}
        >
          <p className="text-ui text-muted-foreground">
            {gate === "refuse" ? (
              "This file is too large to preview."
            ) : (
              <>
                Large files aren't previewed automatically.{" "}
                <button
                  type="button"
                  onClick={() => setAsked(true)}
                  className="cursor-pointer font-medium text-foreground hover:underline"
                >
                  Preview anyway
                </button>
              </>
            )}
          </p>
        </DocumentCard>
      );
    }
    return (
      <DocumentCard
        name={source.name}
        meta={meta}
        downloadUrl={source.url}
        titleBarFor={source}
        // Only when the viewer would draw it: a text file of unknown size
        // would open on the download pane.
        onExpand={
          viewer !== null && canPreview ? () => viewer.show(source) : undefined
        }
        className={className}
        collapsedClassName={options.collapsedClassName}
      >
        <Next source={source} placement="document" />
      </DocumentCard>
    );
  }

  return {
    name: "attachment-card",
    accepts: (source, placement) =>
      source.kind === "file" && placement === "document" && isTextEmbed(source),
    display: "block",
    Component: AttachmentCard,
  };
}
