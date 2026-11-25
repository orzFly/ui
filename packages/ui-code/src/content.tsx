import {
  type ContentProps,
  type ContentRenderer,
  type ContentSource,
  isTextFile,
} from "@orz/ui-content";
import { CappedCodeBlock } from "./capped-code-block.tsx";
import { fenceFilename } from "./code-block.tsx";
import {
  FENCE_COLLAPSE_LINES,
  FenceFrame,
  useInFenceFrame,
} from "./fence-frame.tsx";
import { FileText } from "./file-text.tsx";

function accepts(source: ContentSource): boolean {
  return source.kind === "inline" || isTextFile(source);
}

function Code({ source, placement, className }: ContentProps) {
  if (source.kind === "file") {
    return (
      <FileText source={source} placement={placement} className={className}>
        {(text) => (
          <CappedCodeBlock
            filename={source.name}
            contents={text}
            lineNumbers
            offThread
            // A document's file sits in a card that clips its body; the
            // viewer's pane hands down the height it may fill.
            capClassName={
              placement === "viewer"
                ? "max-h-(--attachment-pane-height) overflow-auto"
                : "max-h-80 overflow-hidden"
            }
          />
        )}
      </FileText>
    );
  }
  return (
    <div className={className}>
      <InlineCode source={source} />
    </div>
  );
}

function InlineCode({
  source,
}: {
  source: Extract<ContentSource, { kind: "inline" }>;
}) {
  // A surface that frames the block itself (a diagram's source view) has
  // its own Copy already.
  const framed = useInFenceFrame();
  const block = (
    <CappedCodeBlock
      filename={fenceFilename(source.lang)}
      contents={source.text}
      // The first fence in a language compiles that grammar: 520 ms for
      // TypeScript at 4x CPU throttling, in the middle of a page's load.
      offThread
      copy={false}
    />
  );
  if (framed) return block;
  return (
    <FenceFrame
      text={source.text}
      lang={source.lang}
      title={source.title}
      collapsible={
        source.collapse !== false &&
        source.text.split("\n").length > FENCE_COLLAPSE_LINES
      }
    >
      {block}
    </FenceFrame>
  );
}

/**
 * The registry entry for code: every inline source (a fenced block, whatever its language) and
 * every text file, in either placement. It takes everything a narrower renderer would, so register
 * it after them — markdown files, mermaid diagrams, patches.
 *
 * It highlights at most `TEXT_PREVIEW_MAX_BYTES`, and draws text found larger plain. A file
 * declared over `TEXT_PREVIEW_HARD_MAX_BYTES` is not loaded. Both tokenize in the worker a
 * `CodeWorkerProvider` lends, a file inside a height cap.
 *
 * An inline source sits in a `FenceFrame`: Copy, its language or the `title` it names, and past
 * `FENCE_COLLAPSE_LINES` a cap behind Expand unless its `collapse` is false.
 */
export const codeContent: ContentRenderer = {
  name: "code",
  accepts,
  display: "block",
  Component: Code,
};
