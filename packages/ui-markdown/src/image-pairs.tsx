import type { ContentSource } from "@orz/ui-content";
import {
  type ComparePair,
  DeletedAttachmentMark,
  type FileSource,
  useViewerCompare,
} from "@orz/ui-content/attachment";
import {
  type CompareSide,
  DEFAULT_COMPARE_LABELS,
  MediaCompare,
} from "@orz/ui-content/compare";
import { type SyntheticEvent, useCallback, useRef, useState } from "react";
import {
  isPairImage,
  pairLabel,
  rehypeImagePairs,
} from "./lib/rehype-image-pairs.ts";
import type { MarkdownPlugin } from "./plugin.ts";

export type ImagePairsOptions = {
  /**
   * Turns an image address into the file it names, or null to draw the address as it is:
   * `markdownEmbeds`' signature, so one function serves both. A resolved file's `url` is what the
   * comparison draws and its name what the viewer shows; one it marks `deleted` is a side that
   * failed.
   */
  resolve?: (href: string) => ContentSource | null;
};

type Size = { width: number; height: number };

type Image = { src: string; alt: string };

/**
 * Draws a paragraph that is exactly two images with an arrow between them, `![v1](a.png) →
 * ![v2](b.png)` (or `->`), as one `MediaCompare`, its sides tagged by the two alts, or Before and
 * After where an alt is empty or only the file's name. Within an `AttachmentViewerProvider` a
 * click on either picture opens the pair in the viewer, paging through every comparison below
 * the provider, in document order. Anywhere else in a sentence, the images stay images.
 *
 * Put it before `markdownEmbeds` or after it, as you like: the embeds plugin leaves a pair alone.
 * Returns a new plugin on every call, so memoise the call along with the rest of the plugin list.
 */
export function imagePairs({
  resolve,
}: ImagePairsOptions = {}): MarkdownPlugin {
  function ImagePair({
    before,
    after,
    className,
  }: {
    before: Image;
    after: Image;
    className?: string;
  }) {
    // undefined until reported; null once it failed.
    const [beforeSize, setBeforeSize] = useState<Size | null>();
    const [afterSize, setAfterSize] = useState<Size | null>();
    const beforeFile = fileOf(before, resolve);
    const afterFile = fileOf(after, resolve);
    const labels = {
      before: pairLabel(
        before.alt,
        before.src,
        DEFAULT_COMPARE_LABELS.before,
        beforeFile.name,
      ),
      after: pairLabel(
        after.alt,
        after.src,
        DEFAULT_COMPARE_LABELS.after,
        afterFile.name,
      ),
    };
    const pair: ComparePair | null =
      beforeSize == null || afterSize == null
        ? null
        : {
            before: {
              label: labels.before,
              size: beforeSize,
              file: beforeFile,
            },
            after: { label: labels.after, size: afterSize, file: afterFile },
          };

    const anchor = useRef<HTMLDivElement>(null);
    const open = useViewerCompare(pair, anchor);

    const side = (
      label: string,
      image: Image,
      file: FileSource,
      size: Size | null | undefined,
      onSize: (size: Size | null) => void,
    ): CompareSide =>
      file.deleted
        ? {
            label,
            size: null,
            failed: true,
            content: <DeletedAttachmentMark name={file.name} />,
          }
        : {
            label,
            size: size ?? null,
            failed: size === null,
            content: (
              <PairImage
                src={file.url ?? image.src}
                alt={image.alt}
                onSize={onSize}
              />
            ),
          };

    return (
      <div ref={anchor} className="contents">
        <MediaCompare
          before={side(
            labels.before,
            before,
            beforeFile,
            beforeSize,
            setBeforeSize,
          )}
          after={side(labels.after, after, afterFile, afterSize, setAfterSize)}
          onOpen={open}
          className={className}
        />
      </div>
    );
  }

  return {
    name: "image-pairs",
    rehypePlugins: [rehypeImagePairs],
    components: {
      img: function PairedImage({ Next, node, ...props }) {
        if (!isPairImage(node) || node === undefined) {
          return <Next node={node} {...props} />;
        }
        return (
          <ImagePair
            before={{
              src: String(node.properties.dataPairBeforeSrc ?? ""),
              alt: String(node.properties.dataPairBeforeAlt ?? ""),
            }}
            after={{ src: props.src ?? "", alt: props.alt ?? "" }}
            className={props.className}
          />
        );
      },
      // A comparison is block content, which a <p> cannot hold: the paragraph
      // becomes a <div> with its typography, keeping its props (a source-line
      // stamp, a decoration class).
      p: function PairParagraph({ Next, node, ...props }) {
        const holdsPair = (node?.children ?? []).some(
          (child) => child.type === "element" && isPairImage(child),
        );
        if (!holdsPair) return <Next node={node} {...props} />;
        const { children, className, ...rest } = props;
        return (
          <div
            {...rest}
            className={
              className
                ? `markdown-paragraph ${className}`
                : "markdown-paragraph"
            }
          >
            {children}
          </div>
        );
      },
    },
  };
}

/** What the viewer needs of a side: its address, and a name to show and download it by. */
function fileOf(
  image: Image,
  resolve: ImagePairsOptions["resolve"],
): FileSource {
  const source = resolve?.(image.src) ?? null;
  if (source?.kind === "file") {
    return source.url === undefined ? { ...source, url: image.src } : source;
  }
  return { kind: "file", name: nameOf(image), url: image.src };
}

function nameOf(image: Image): string {
  try {
    const last = new URL(image.src, "http://x").pathname.split("/").pop();
    if (last) return decodeURIComponent(last);
  } catch {
    // An address that does not parse, or a segment that does not decode, is
    // named by its alt instead.
  }
  return image.alt || "image";
}

/** A side's `<img>`, reporting its natural size once it has one, or null when it fails. */
function PairImage({
  src,
  alt,
  onSize,
}: {
  src: string;
  alt: string;
  onSize(size: Size | null): void;
}) {
  const report = useCallback(
    (img: HTMLImageElement) =>
      onSize({ width: img.naturalWidth, height: img.naturalHeight }),
    [onSize],
  );
  // An image the browser had cached can finish before React listens for it.
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete && img.naturalWidth > 0) report(img);
    },
    [report],
  );
  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      draggable={false}
      onLoad={(e: SyntheticEvent<HTMLImageElement>) => report(e.currentTarget)}
      onError={() => onSize(null)}
    />
  );
}
