import { Button } from "@orz/ui/components/button";
import {
  ContentFallback,
  type ContentProps,
  type ContentRenderer,
  type ContentSource,
  isTextFile,
  TEXT_PREVIEW_MAX_BYTES,
  useSourceText,
} from "@orz/ui-content";
import { useMemo } from "react";
import { CodeBlock, fenceFilename, PlainCodeFallback } from "./code-block.tsx";

type FileSource = Extract<ContentSource, { kind: "file" }>;

function accepts(source: ContentSource): boolean {
  return source.kind === "inline" || isTextFile(source);
}

/**
 * Whether `text` takes more than `max` bytes as UTF-8, counted without encoding it, and stopping
 * as soon as it is over.
 */
export function exceedsBytes(text: string, max: number): boolean {
  // Every UTF-16 unit is at least one byte and at most three.
  if (text.length > max) return true;
  if (text.length * 3 <= max) return false;
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    // A surrogate is half of a four-byte character.
    bytes +=
      unit < 0x80
        ? 1
        : unit < 0x800 || (unit >= 0xd800 && unit < 0xe000)
          ? 2
          : 3;
    if (bytes > max) return true;
  }
  return false;
}

/**
 * Highlights `contents` when it is within the cap, and draws it as plain text otherwise: pierre
 * over a multi-megabyte text would freeze the tab (T-31), where plain text costs next to nothing.
 */
function CappedCodeBlock({
  filename,
  contents,
  lineNumbers,
}: {
  filename: string;
  contents: string;
  lineNumbers?: boolean;
}) {
  const tooLarge = useMemo(
    () => exceedsBytes(contents, TEXT_PREVIEW_MAX_BYTES),
    [contents],
  );
  if (tooLarge) return <PlainCodeFallback contents={contents} />;
  return (
    <CodeBlock
      filename={filename}
      contents={contents}
      lineNumbers={lineNumbers}
    />
  );
}

/** A file declared over the cap is not loaded at all. */
function TooLargeFile({
  source,
  placement,
  className,
}: ContentProps & { source: FileSource }) {
  return (
    <div className={className}>
      <ContentFallback source={source} placement={placement} />{" "}
      <span>Too large to preview — download to view.</span>
    </div>
  );
}

function CodeFile({
  source,
  placement,
  className,
}: ContentProps & { source: FileSource }) {
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
  // CodeBlock only hands its className to pierre's view, which is not mounted
  // while the plain-text stand-in shows; the wrapper keeps it on the root
  // throughout.
  return (
    <div className={className}>
      <CappedCodeBlock
        filename={source.name}
        // pierre numbers the empty line after a file's final newline, so
        // every well-formed file would end on a blank numbered line.
        contents={text.text.replace(/\r?\n$/, "")}
        lineNumbers
      />
    </div>
  );
}

function Code({ source, placement, className }: ContentProps) {
  if (source.kind === "file") {
    if (source.size !== undefined && source.size > TEXT_PREVIEW_MAX_BYTES) {
      return (
        <TooLargeFile
          source={source}
          placement={placement}
          className={className}
        />
      );
    }
    return (
      <CodeFile source={source} placement={placement} className={className} />
    );
  }
  return (
    <div className={className}>
      <CappedCodeBlock
        filename={fenceFilename(source.lang)}
        contents={source.text}
      />
    </div>
  );
}

/**
 * The registry entry for code: every inline source (a fenced block, whatever its language) and
 * every text file, in either placement. It takes everything a narrower renderer would, so register
 * it after them — markdown files, mermaid diagrams.
 *
 * It highlights at most `TEXT_PREVIEW_MAX_BYTES`: a file declared larger is not loaded, and text
 * found larger once loaded is drawn plain.
 */
export const codeContent: ContentRenderer = {
  name: "code",
  accepts,
  display: "block",
  Component: Code,
};
