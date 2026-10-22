import type { ContentSource } from "@orz/ui-content";
import { AttachmentLink } from "@orz/ui-content/attachment";
import type { MarkdownPlugin } from "./plugin.ts";

export type AttachmentLinksOptions = {
  /**
   * Turns a link address into the file it points at, or null to leave the link alone. The same
   * function `markdownEmbeds` takes, so an app passes one resolver to both.
   */
  resolve: (href: string) => ContentSource | null;
  /** Draw the chips with a border. Default false: underlined on hover. */
  boxed?: boolean;
};

/**
 * Draws a markdown link to a file as an `AttachmentLink` chip, which opens the nearest attachment
 * viewer on a plain click. Links that do not resolve to a file go on to the plugins after this one.
 *
 * Returns a new plugin on every call, so memoise the call along with the rest of the plugin list.
 */
export function attachmentLinks({
  resolve,
  boxed,
}: AttachmentLinksOptions): MarkdownPlugin {
  return {
    name: "attachment-links",
    components: {
      a: function AttachmentAnchor({ Next, node, ...props }) {
        const source =
          typeof props.href === "string" ? resolve(props.href) : null;
        if (source === null || source.kind !== "file") {
          return <Next node={node} {...props} />;
        }
        return (
          <AttachmentLink
            file={source}
            boxed={boxed}
            className={props.className}
          >
            {props.children}
          </AttachmentLink>
        );
      },
    },
  };
}
