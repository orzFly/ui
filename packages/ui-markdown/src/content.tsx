import { Button } from "@orz/ui/components/button";
import {
  ContentFallback,
  type ContentProps,
  type ContentRenderer,
  type ContentSource,
  useContentDepth,
  useContentMaxDepth,
  useSourceText,
} from "@orz/ui-content";
import { useContext } from "react";
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

function isMarkdownFile(source: ContentSource): boolean {
  if (source.kind !== "file") return false;
  const mime = source.mime?.split(";")[0]?.trim().toLowerCase();
  return /\.(md|markdown)$/i.test(source.name) || mime === "text/markdown";
}

/**
 * The registry entry for markdown files, in either placement. Register it ahead of any renderer
 * that takes every text file, since the first renderer that accepts wins.
 *
 * Returns a new renderer on every call, so call it once, where the renderer list is built.
 */
export function markdownContent(
  options: MarkdownContentOptions = {},
): ContentRenderer {
  function MarkdownFile({ source, placement, className }: ContentProps) {
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
      <Markdown plugins={hostPlugins ?? options.plugins} className={className}>
        {text.text}
      </Markdown>
    );
  }

  return {
    name: "markdown",
    accepts: isMarkdownFile,
    display: "block",
    Component: MarkdownFile,
  };
}
