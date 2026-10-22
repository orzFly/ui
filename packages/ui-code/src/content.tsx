import { Button } from "@orz/ui/components/button";
import {
  ContentFallback,
  type ContentProps,
  type ContentRenderer,
  type ContentSource,
  isTextFile,
  useSourceText,
} from "@orz/ui-content";
import { CodeBlock, fenceFilename } from "./code-block.tsx";

type FileSource = Extract<ContentSource, { kind: "file" }>;

function accepts(source: ContentSource): boolean {
  return source.kind === "inline" || isTextFile(source);
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
      <CodeBlock
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
    return (
      <CodeFile source={source} placement={placement} className={className} />
    );
  }
  return (
    <div className={className}>
      <CodeBlock filename={fenceFilename(source.lang)} contents={source.text} />
    </div>
  );
}

/**
 * The registry entry for code: every inline source (a fenced block, whatever its language) and
 * every text file, in either placement. It takes everything a narrower renderer would, so register
 * it after them — markdown files, mermaid diagrams.
 */
export const codeContent: ContentRenderer = {
  name: "code",
  accepts,
  display: "block",
  Component: Code,
};
