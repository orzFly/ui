import { file, group, resolve } from "@orz/fixtures/files.ts";
import { ATTACHMENT_RENDERERS } from "@orz/fixtures/renderers.ts";
import { Content } from "@orz/ui-content";
import {
  attachmentLinks,
  markdownContent,
  markdownEmbeds,
} from "@orz/ui-markdown";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRenderers, withViewer, withWidth } from "./decorators.tsx";
import { registrationSnippet } from "./snippets.ts";

// First, so it wins over the plain markdownContent() in the shared list.
const MD = markdownContent({
  plugins: [markdownEmbeds({ resolve }), attachmentLinks({ resolve })],
});

/** `@orz/ui-markdown`'s renderer for `.md` files, registered with `@orz/ui-content`. */
const meta = {
  title: "ui-markdown/Content",
  decorators: [
    withWidth("max-w-3xl"),
    withViewer({ group }),
    withRenderers(MD, ...ATTACHMENT_RENDERERS),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A markdown file in viewer placement, which has no depth limit for itself. There is no
 * enclosing `<Markdown>` to take plugins from, so the renderer's own `plugins` option applies.
 * The viewer dialog itself is on the AttachmentViewerProvider page.
 */
export const Markdown: Story = {
  render: () => <Content source={file("guide.md")} placement="viewer" />,
  parameters: {
    docs: {
      source: {
        code: registrationSnippet({
          renderers: [
            ["@orz/ui-markdown", "markdownContent({ plugins })"],
            ["@orz/ui-content/attachment", "attachmentCard()"],
            ["@orz/ui-content/attachment", "imageContent()"],
            ["@orz/ui-code", "codeContent"],
          ],
          uses: [
            ["@orz/ui-content", "Content"],
            ["@orz/ui-content/attachment", "AttachmentViewerProvider"],
          ],
          body: '<AttachmentViewerProvider>\n  <Content source={file} placement="viewer" />\n</AttachmentViewerProvider>',
        }),
        language: "tsx",
      },
    },
  },
};
