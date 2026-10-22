import {
  type ContentProps,
  type ContentRenderer,
  type ContentSource,
  isPatchFile,
  useContentTitleBar,
} from "@orz/ui-content";
import { fenceFilename } from "./code-block.tsx";
import { FileText } from "./file-text.tsx";
import { PatchView } from "./patch-view.tsx";

function accepts(source: ContentSource): boolean {
  if (source.kind === "inline") {
    const lang = source.lang?.toLowerCase();
    return lang === "diff" || lang === "patch";
  }
  return isPatchFile(source);
}

function Patch({ source, placement, className }: ContentProps) {
  const titleBar = useContentTitleBar(source);
  if (source.kind === "inline") {
    return (
      <div className={className}>
        <PatchView
          filename={fenceFilename(source.lang)}
          text={source.text}
          titleBar={titleBar}
        />
      </div>
    );
  }
  return (
    <FileText source={source} placement={placement} className={className}>
      {(text) => (
        <PatchView
          filename={source.name}
          text={text}
          lineNumbers
          invalidNote
          // A document that lends its title bar is a card, which hides what
          // overflows its collapsed body.
          fit={
            placement === "viewer"
              ? "pane"
              : titleBar !== undefined
                ? "clipped"
                : "flow"
          }
          titleBar={titleBar}
        />
      )}
    </FileText>
  );
}

/**
 * The registry entry for unified diffs: a source tagged `diff` or `patch` (a fenced block) and a
 * file `isPatchFile` calls a patch, in either placement. Each is drawn as one diff per file under
 * its commit's subject and message, with a file list and a toggle back to the text as written.
 * Register it before `codeContent`, which takes every inline source and text file.
 *
 * A fence that is not a patch, such as a bare `+`/`-` snippet, stays highlighted text; a file
 * that is not one says so above its text. The controls go into the title bar a surrounding card
 * lends (`useContentTitleBar`), or into a frame of the patch's own.
 */
export const patchContent: ContentRenderer = {
  name: "patch",
  accepts,
  display: "block",
  Component: Patch,
};
