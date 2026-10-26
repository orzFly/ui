import {
  AttachmentLink,
  DeletedAttachmentMark as DeletedAttachmentMarkView,
} from "@orz/ui-content/attachment";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRenderers, withViewer, withWidth } from "./decorators.tsx";
import { file, group } from "./fixtures/files.ts";
import { ATTACHMENT_RENDERERS } from "./fixtures/renderers.ts";

/**
 * An inline link to a file: a LinkChip wearing the file's type icon. A plain click opens the
 * viewer when it can draw the file; a modifier click is the browser's.
 */
const meta = {
  title: "ui-content/AttachmentLink",
  component: AttachmentLink,
  args: { file: file("guide.md"), boxed: false },
  decorators: [
    withWidth("markdown-body max-w-xl"),
    withViewer({ group }),
    withRenderers(...ATTACHMENT_RENDERERS),
  ],
} satisfies Meta<typeof AttachmentLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Boxed: Story = { args: { boxed: true } };

/** Children replace the file name as the label. */
export const Children: Story = {
  args: { file: file("gradient.png"), children: "the gradient" },
};

/**
 * In running text. The archive has no preview, so a click on it falls through to the browser,
 * which downloads it.
 */
export const InProse: Story = {
  render: (args) => (
    <p>
      See <AttachmentLink {...args} />, the{" "}
      <AttachmentLink file={file("gradient.png")}>gradient</AttachmentLink> and{" "}
      <AttachmentLink file={file("bundle.zip")} />.
    </p>
  ),
};

/** A file the app marks `deleted`: its name struck through, and no link. */
export const Deleted: Story = {
  args: { file: { ...file("guide.md"), deleted: true } },
};

/**
 * What `attachmentLinks` and `markdownEmbeds` draw in a document for a link or embed of a deleted
 * file: the name it was linked under, struck through, and the word "deleted".
 */
export const DeletedAttachmentMark: Story = {
  render: () => <DeletedAttachmentMarkView name="logo.svg" />,
};
