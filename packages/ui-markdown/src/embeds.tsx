import {
  Content,
  type ContentSource,
  isImageFile,
  useContentDisplayOf,
} from "@orz/ui-content";
import { DeletedAttachmentMark } from "@orz/ui-content/attachment";
import type { Element, ElementContent, Root } from "hast";
import type { ReactNode } from "react";
import { isSoftBreak } from "./lib/markdown-processor.ts";
import { isPairImage } from "./lib/rehype-image-pairs.ts";
import type { MarkdownPlugin } from "./plugin.ts";

type DisplayOf = ReturnType<typeof useContentDisplayOf>;

/** Marks an `<img>` inside a link, as React hands it to an `img` override. */
const LINKED_ATTR = "data-linked-image";

function rehypeLinkedImages() {
  const visit = (parent: Root | Element, linked: boolean): void => {
    for (const child of parent.children) {
      if (child.type !== "element") continue;
      if (linked && child.tagName === "img")
        child.properties.dataLinkedImage = "";
      visit(child, linked || child.tagName === "a");
    }
  };
  return (tree: Root) => visit(tree, false);
}

export type MarkdownEmbedsOptions = {
  /**
   * Turns an image address into a source to draw, or null to leave the `<img>` alone. It must
   * be synchronous and pure: whether a paragraph is a `<p>` is decided from it during render.
   */
  resolve: (href: string) => ContentSource | null;
};

/**
 * Draws a markdown image through `@orz/ui-content` when its address resolves to a source some
 * registered renderer accepts, such as `![spec](attachment-address)` resolving to a markdown file.
 * A file `resolve` marks `deleted` is a `DeletedAttachmentMark` instead. An image inside a link
 * stays a plain image of the file, and a click on it is the link's.
 *
 * Returns a new plugin on every call, so memoise the call along with the rest of the plugin list.
 */
export function markdownEmbeds({
  resolve,
}: MarkdownEmbedsOptions): MarkdownPlugin {
  const sourceOf = (src: unknown): ContentSource | null =>
    typeof src === "string" ? resolve(src) : null;

  /**
   * Whether a paragraph's child is an image drawn as a block. Answered from the markdown,
   * `resolve` and the renderers' synchronous `accepts`, never from loaded data: an element type
   * that flipped when data arrived would unmount and rebuild the whole paragraph (T-60).
   */
  const isBlockEmbed = (child: ElementContent, displayOf: DisplayOf) => {
    if (child.type !== "element" || child.tagName !== "img") return false;
    const source = sourceOf(child.properties.src);
    if (source === null) return false;
    // A deleted file is an inline mark, whatever would draw it.
    if (source.kind === "file" && source.deleted) return false;
    return displayOf(source, "document") === "block";
  };

  return {
    name: "embeds",
    rehypePlugins: [rehypeLinkedImages],
    components: {
      img: function EmbedImage({ Next, node, ...marked }) {
        const { [LINKED_ATTR]: linked, ...props } = marked as typeof marked & {
          [LINKED_ATTR]?: string;
        };
        const displayOf = useContentDisplayOf();
        // A pair `imagePairs` folded into one image is its comparison to draw.
        if (isPairImage(node)) return <Next node={node} {...props} />;
        const source = sourceOf(props.src);
        if (source?.kind === "file" && source.deleted) {
          return (
            <DeletedAttachmentMark
              name={source.name}
              className={props.className}
            />
          );
        }
        if (source === null || displayOf(source, "document") === null) {
          return <Next node={node} {...props} />;
        }
        // The image renderer draws a link of its own, which a link cannot
        // hold (UI-249).
        if (
          linked !== undefined &&
          source.kind === "file" &&
          isImageFile(source) &&
          source.url !== undefined
        ) {
          return (
            <Next
              node={node}
              {...props}
              src={source.url}
              alt={props.alt || source.name}
            />
          );
        }
        // The <img>'s class survives the swap: a decoration pass marks the
        // element the embed was written as (T-223).
        return (
          <Content
            source={source}
            placement="document"
            className={props.className}
          />
        );
      },
      // Block content is forbidden inside a <p>, so a paragraph carrying a
      // block embed becomes a <div> with the paragraph's typography. The
      // cost of deciding it before any data loads: a paragraph whose embed
      // turns out to point nowhere stays a `div.markdown-paragraph`.
      p: function EmbedParagraph({ Next, node, ...props }) {
        const displayOf = useContentDisplayOf();
        const isBlock = (child: ElementContent) =>
          isBlockEmbed(child, displayOf);
        const kids = node?.children ?? [];
        if (!kids.some(isBlock)) return <Next node={node} {...props} />;
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
            {withoutBreaksAfterBlocks(kids, children, isBlock)}
          </div>
        );
      },
      // A tight list item has no <p>: its opening line sits in the <li>,
      // which may hold a block as it is.
      li: function EmbedItem({ Next, node, ...props }) {
        const displayOf = useContentDisplayOf();
        const isBlock = (child: ElementContent) =>
          isBlockEmbed(child, displayOf);
        const kids = node?.children ?? [];
        if (!kids.some(isBlock)) return <Next node={node} {...props} />;
        const { children, ...rest } = props;
        return (
          <Next node={node} {...rest}>
            {withoutBreaksAfterBlocks(kids, children, isBlock)}
          </Next>
        );
      },
    },
  };
}

/**
 * `children` without the soft breaks (`<Markdown breaks>`) that follow a block embed. The embed
 * ends its own line, so such a `<br>` would only leave a blank line under it; a break before one
 * ends a line of text, which the block's edge adds nothing to, and stays. `children` are
 * react-markdown's, one for each of `kids`; where they are not, nothing is dropped.
 */
function withoutBreaksAfterBlocks(
  kids: ElementContent[],
  children: ReactNode,
  isBlock: (child: ElementContent) => boolean,
): ReactNode {
  if (!Array.isArray(children) || children.length !== kids.length) {
    return children;
  }
  let previous: ElementContent | undefined;
  const kept = children.filter((_, index) => {
    const child = kids[index];
    if (child === undefined) return true;
    if (isSoftBreak(child) && previous !== undefined && isBlock(previous)) {
      return false;
    }
    if (!(child.type === "text" && child.value.trim() === "")) previous = child;
    return true;
  });
  return kept.length === children.length ? children : kept;
}
