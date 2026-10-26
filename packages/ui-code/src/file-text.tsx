import { Button } from "@orz/ui/components/button";
import {
  ContentFallback,
  type ContentProps,
  type ContentSource,
  TEXT_PREVIEW_HARD_MAX_BYTES,
  useSourceText,
} from "@orz/ui-content";
import type { ReactNode } from "react";

export type FileSource = Extract<ContentSource, { kind: "file" }>;

/** A file declared over the hard cap is not loaded at all. */
function TooLargeFile({
  source,
  placement,
  className,
}: ContentProps & { source: FileSource }) {
  return (
    <div className={className}>
      <ContentFallback source={source} placement={placement} />{" "}
      <span>This file is too large to preview.</span>
    </div>
  );
}

function LoadedText({
  source,
  placement,
  className,
  children,
}: ContentProps & {
  source: FileSource;
  children: (text: string) => ReactNode;
}) {
  const text = useSourceText(source);
  if (text.status === "loading") {
    return (
      <ContentFallback
        source={source}
        placement={placement}
        className={className}
      />
    );
  }
  if (text.status === "error") {
    return (
      <div className={className}>
        <ContentFallback source={source} placement={placement} />{" "}
        <span>{text.error.message}</span>{" "}
        <Button size="xs" variant="outline" onClick={text.retry}>
          Retry
        </Button>
      </div>
    );
  }
  // A code view only hands its className to pierre's view, which is not
  // mounted while the plain-text stand-in shows; the wrapper keeps it on the
  // root throughout.
  return (
    <div className={className}>
      {
        // pierre numbers the empty line after a file's final newline, so
        // every well-formed file would end on a blank numbered line.
        children(text.text.replace(/\r?\n$/, ""))
      }
    </div>
  );
}

/**
 * A text file's contents, once loaded and without its final newline, drawn by `children`; while
 * it loads, or when it fails or is declared over `TEXT_PREVIEW_HARD_MAX_BYTES`, the registry's
 * fallback with a note. Between that and `TEXT_PREVIEW_MAX_BYTES` it loads: the viewer and the
 * embed card ask first, and `children` draws text that large plain.
 */
export function FileText(
  props: ContentProps & {
    source: FileSource;
    children: (text: string) => ReactNode;
  },
) {
  const { source, placement, className } = props;
  if (source.size !== undefined && source.size > TEXT_PREVIEW_HARD_MAX_BYTES) {
    return (
      <TooLargeFile
        source={source}
        placement={placement}
        className={className}
      />
    );
  }
  return <LoadedText {...props} />;
}
