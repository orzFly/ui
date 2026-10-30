import { Button } from "@orz/ui/components/button";
import { cn } from "@orz/ui/lib/utils";
import {
  ContentFallback,
  type ContentProps,
  type ContentRenderer,
  type ContentSource,
  useContentDepth,
  useContentMaxDepth,
  useContentTitleBar,
  useSourceText,
} from "@orz/ui-content";
import { CodeIcon } from "lucide-react";
import { type ComponentType, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { Markdown, MarkdownPluginsContext } from "./markdown.tsx";
import type { MarkdownPlugin } from "./plugin.ts";

export type MarkdownContentOptions = {
  /**
   * Plugins for a document drawn outside any `<Markdown>`, such as in a viewer. Inside one, the
   * enclosing document's plugins win, so an embed is drawn the way its host is.
   */
  plugins?: readonly MarkdownPlugin[];
  /**
   * How many embedded documents deep a document still renders in `"document"` placement; past it,
   * the document is a link. Defaults to the provider's `maxDepth`, else 1: a document inside a
   * document shows its own documents as links, which is what stops a document that embeds itself.
   */
  maxDepth?: number;
};

const NOTHING: ContentSource = { kind: "inline", text: "" };

/**
 * Past this a markdown file opens as its source, and renders on request. Highlighting can move
 * off the main thread, react-markdown's tree cannot: 64 KiB of dense markdown blocked the tab for
 * 1.0 s and 256 KiB for 3.4 s. Counted in characters, since the text is already decoded by then.
 */
export const MARKDOWN_RENDER_MAX_CHARS = 128 * 1024;

/**
 * Rendered, or the markdown as written, drawn by the renderers after this one (`codeContent`). A
 * large one opens as written. The toggle goes into the title bar the surface lends (a viewer, an
 * embed card); a large document with none gets it above.
 */
function MarkdownDocument({
  source,
  placement,
  className,
  text,
  plugins,
  Next,
}: ContentProps & {
  text: string;
  plugins: readonly MarkdownPlugin[] | undefined;
  Next: ComponentType<ContentProps>;
}) {
  const titleBar = useContentTitleBar(source);
  const large = text.length > MARKDOWN_RENDER_MAX_CHARS;
  const [showSource, setShowSource] = useState(large);
  const control = (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      aria-pressed={showSource}
      title={
        showSource ? "Back to the rendered document" : "The markdown as written"
      }
      className={cn(
        "font-normal text-muted-foreground",
        showSource && "bg-muted text-foreground pressed-cue",
      )}
      onClick={() => setShowSource((shown) => !shown)}
    >
      <CodeIcon />
      source
    </Button>
  );
  const body = showSource ? (
    <div className={className}>
      {large && (
        <p className="mb-2 text-ui-sm text-muted-foreground">
          Too large to render automatically.
        </p>
      )}
      <Next source={source} placement={placement} />
    </div>
  ) : (
    <Markdown plugins={plugins} className={className}>
      {text}
    </Markdown>
  );
  if (titleBar === undefined) {
    // A document drawn in another one's flow, with no surface of its own,
    // gets a row for the toggle only when it opened as source.
    if (!large) return body;
    return (
      <>
        <div className="mb-1 flex justify-end">{control}</div>
        {body}
      </>
    );
  }
  return (
    <>
      {titleBar !== null && createPortal(control, titleBar)}
      {body}
    </>
  );
}

function isMarkdownFile(source: ContentSource): boolean {
  if (source.kind !== "file") return false;
  const mime = source.mime?.split(";")[0]?.trim().toLowerCase();
  return /\.(md|markdown)$/i.test(source.name) || mime === "text/markdown";
}

/**
 * The registry entry for markdown files, in either placement. Register it ahead of any renderer
 * that takes every text file, since the first renderer that accepts wins; that renderer draws the
 * file's source when the reader toggles to it, and a file over `MARKDOWN_RENDER_MAX_CHARS` opens
 * that way.
 *
 * Returns a new renderer on every call, so call it once, where the renderer list is built.
 */
export function markdownContent(
  options: MarkdownContentOptions = {},
): ContentRenderer {
  function MarkdownFile({
    source,
    placement,
    className,
    Next,
  }: ContentProps & { Next: ComponentType<ContentProps> }) {
    const depth = useContentDepth();
    const providerMaxDepth = useContentMaxDepth();
    const hostPlugins = useContext(MarkdownPluginsContext);
    const maxDepth = options.maxDepth ?? providerMaxDepth ?? 1;
    // A viewer is never limited: it is what a reader opens on purpose.
    const limited = placement === "document" && depth > maxDepth;
    // A document past the limit is drawn as a link, so nothing is loaded for it.
    const text = useSourceText(limited ? NOTHING : source);
    if (limited) {
      return (
        <ContentFallback
          source={source}
          placement={placement}
          className={className}
        />
      );
    }
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
    return (
      <MarkdownDocument
        source={source}
        placement={placement}
        className={className}
        text={text.text}
        plugins={hostPlugins ?? options.plugins}
        Next={Next}
      />
    );
  }

  return {
    name: "markdown",
    accepts: isMarkdownFile,
    display: "block",
    Component: MarkdownFile,
  };
}
