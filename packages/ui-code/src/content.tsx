import {
  type ContentProps,
  type ContentRenderer,
  type ContentSource,
  isTextFile,
} from "@orz/ui-content";
import { CappedCodeBlock } from "./capped-code-block.tsx";
import { fenceFilename } from "./code-block.tsx";
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
 * it after them — markdown files, mermaid diagrams, patches.
 *
 * It highlights at most `TEXT_PREVIEW_MAX_BYTES`, and draws text found larger plain. A file
 * declared over `TEXT_PREVIEW_HARD_MAX_BYTES` is not loaded.
 */
export const codeContent: ContentRenderer = {
  name: "code",
  accepts,
  display: "block",
  Component: Code,
};
