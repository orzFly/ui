import type { ElementContent } from "hast";
import type { Nodes } from "mdast";
import remarkBreaks from "remark-breaks";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { type PluggableList, unified } from "unified";
import {
  FRONTMATTER_FLAVOURS,
  remarkFrontmatterTable,
} from "./remark-frontmatter-table.ts";
import { remarkRejectedUrlsAsText } from "./remark-rejected-urls.ts";

/**
 * Static Markdown syntax shared by every parser and renderer.
 *
 * Keep runtime-dependent plugins (references, say) in the caller: their
 * options belong to the app's context. Keeping
 * this array at module scope also lets renderers retain plugin-list identity
 * instead of rebuilding the invariant prefix on every render.
 *
 * The order is significant. Rejected URLs are restored to source text before
 * later tokenizers see them, and `remarkFrontmatterTable` consumes the nodes
 * produced by `remarkFrontmatter`. Without that tokenizer, frontmatter lines
 * that begin with digits are parsed as ordered-list items (T-383).
 */
export const MARKDOWN_SYNTAX_PLUGINS: PluggableList = [
  remarkGfm,
  remarkRejectedUrlsAsText,
  [remarkFrontmatter, FRONTMATTER_FLAVOURS],
  remarkFrontmatterTable,
];

/**
 * `MARKDOWN_SYNTAX_PLUGINS` for a text where a single newline is a line break, as in a GitHub
 * comment: what `<Markdown breaks>` parses with. `remarkBreaks` goes last, so every pass the two
 * share sees the same tree in both.
 */
export const MESSAGE_SYNTAX_PLUGINS: PluggableList = [
  ...MARKDOWN_SYNTAX_PLUGINS,
  remarkBreaks,
];

/**
 * Whether a hast child is the `<br>` `MESSAGE_SYNTAX_PLUGINS` made of a single newline, rather
 * than a hard break the author wrote: `remark-breaks` gives its breaks no position.
 */
export function isSoftBreak(child: ElementContent): boolean {
  return (
    child.type === "element" &&
    child.tagName === "br" &&
    child.position === undefined
  );
}

const processor = unified().use(remarkParse).use(MARKDOWN_SYNTAX_PLUGINS);

/**
 * `runSync`, not `parse` alone: `parse` stops at the tokenizer and runs no
 * transformer, so `remarkFrontmatterTable` — which is one — would never fire
 * and the caller would hold the `yaml` leaf while the DOM held a table.
 */
export function parseMarkdown(source: string): Nodes {
  return processor.runSync(processor.parse(source), source) as Nodes;
}
