import { textFile } from "@orz/fixtures/files.ts";
import { SERIES_EML } from "@orz/fixtures/mail.ts";
import { ATTACHMENT_RENDERERS } from "@orz/fixtures/renderers.ts";
import {
  type AttachmentItem,
  AttachmentList,
} from "@orz/ui-content/attachment";
import { emlContent } from "@orz/ui-mail";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRenderers, withViewer, withWidth } from "./decorators.tsx";
import { registrationSnippet } from "./snippets.ts";

const MESSAGE: AttachmentItem = {
  ...textFile("v2-retry-once.eml", "message/rfc822", SERIES_EML),
  key: "v2-retry-once.eml",
};

/**
 * `emlContent` in the registry: in a viewer, a `.eml` or `message/rfc822` file is drawn as a
 * `MailMessage`, its plain/HTML switch in the viewer's title bar. Its attachments open in a second
 * viewer over the first.
 */
const meta = {
  title: "ui-mail/Content",
  parameters: {
    docs: {
      source: {
        code: registrationSnippet({
          renderers: [
            ["@orz/ui-content/attachment", "imageContent()"],
            ["@orz/ui-code", "patchContent"],
            ["@orz/ui-mail", "emlContent"],
          ],
          uses: [
            ["@orz/ui-content/attachment", "AttachmentViewerProvider"],
            ["@orz/ui-content/attachment", "AttachmentList"],
          ],
          body: `<AttachmentViewerProvider>
  <AttachmentList items={[message]} />
</AttachmentViewerProvider>`,
        }),
        language: "tsx",
      },
    },
  },
  decorators: [
    withWidth("max-w-xl"),
    withViewer({}),
    withRenderers(emlContent, ...ATTACHMENT_RENDERERS),
  ],
  render: (args) => <AttachmentList items={args.items} />,
} satisfies Meta<{ items: AttachmentItem[] }>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Click the message to open it. */
export const Eml: Story = {
  args: { items: [MESSAGE] },
};
