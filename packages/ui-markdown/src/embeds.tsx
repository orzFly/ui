import {
  Content,
  type ContentSource,
  useContentDisplayOf,
} from "@orz/ui-content";
import type { MarkdownPlugin } from "./plugin.ts";

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
 *
 * Returns a new plugin on every call, so memoise the call along with the rest of the plugin list.
 */
export function markdownEmbeds({
  resolve,
}: MarkdownEmbedsOptions): MarkdownPlugin {
  const sourceOf = (src: unknown): ContentSource | null =>
    typeof src === "string" ? resolve(src) : null;

  return {
    name: "embeds",
    components: {
      img: function EmbedImage({ Next, node, ...props }) {
        const displayOf = useContentDisplayOf();
        const source = sourceOf(props.src);
        if (source === null || displayOf(source, "document") === null) {
          return <Next node={node} {...props} />;
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
      // block embed becomes a <div> with the paragraph's typography. This is
      // answered from the markdown, `resolve` and the renderers' synchronous
      // `accepts`, never from loaded data: an element type that flipped when
      // data arrived would unmount and rebuild the whole paragraph (T-60).
      // The cost: a paragraph whose embed turns out to point nowhere stays a
      // `div.markdown-paragraph`.
      p: function EmbedParagraph({ Next, node, ...props }) {
        const displayOf = useContentDisplayOf();
        const carriesBlock = (node?.children ?? []).some((child) => {
          if (child.type !== "element" || child.tagName !== "img") return false;
          const source = sourceOf(child.properties.src);
          return source !== null && displayOf(source, "document") === "block";
        });
        if (!carriesBlock) return <Next node={node} {...props} />;
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
            {children}
          </div>
        );
      },
    },
  };
}
