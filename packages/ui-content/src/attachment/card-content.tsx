import type { ComponentType } from "react";
import { formatSize, isTextEmbed } from "../file-kind.ts";
import { useContentDepth, useContentMaxDepth } from "../registry.tsx";
import type { ContentProps, ContentRenderer } from "../types.ts";
import { DocumentCard } from "./document-card.tsx";
import { AttachmentLink } from "./link.tsx";
import { TEXT_PREVIEW_MAX_BYTES, useAttachmentViewer } from "./viewer.tsx";

export type AttachmentCardOptions = {
  /** Text files above this draw a note instead of their contents. Default 1 MiB. */
  maxBytes?: number;
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
  const maxBytes = options.maxBytes ?? TEXT_PREVIEW_MAX_BYTES;

  function AttachmentCard({
    source,
    className,
    Next,
  }: ContentProps & { Next: ComponentType<ContentProps> }) {
    const depth = useContentDepth();
    const providerMaxDepth = useContentMaxDepth();
    const viewer = useAttachmentViewer();
    if (source.kind !== "file") return null;
    const maxDepth = options.maxDepth ?? providerMaxDepth ?? 1;
    // A document inside a document card shows its own documents as links,
    // which is what stops a document that embeds itself.
    if (depth > maxDepth) {
      return <AttachmentLink file={source} className={className} />;
    }
    const meta =
      source.size === undefined ? undefined : formatSize(source.size);
    if (source.size !== undefined && source.size > maxBytes) {
      return (
        <DocumentCard
          name={source.name}
          meta={meta}
          downloadUrl={source.url}
          className={className}
          collapsedClassName={options.collapsedClassName}
        >
          <p className="text-sm text-muted-foreground">
            Too large to preview — download to view.
          </p>
        </DocumentCard>
      );
    }
    return (
      <DocumentCard
        name={source.name}
        meta={meta}
        downloadUrl={source.url}
        onExpand={viewer === null ? undefined : () => viewer.show(source)}
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
