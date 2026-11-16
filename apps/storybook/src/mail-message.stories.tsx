import {
  ENCODED_EML,
  ENCODED_EML_BYTES,
  FLOWED_EML,
  HTML_ONLY_EML,
  SERIES_EML,
} from "@orz/fixtures/mail.ts";
import { ATTACHMENT_RENDERERS } from "@orz/fixtures/renderers.ts";
import { MailMessage } from "@orz/ui-mail";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRenderers, withWidth } from "./decorators.tsx";

const ENCODED_SNIPPET = `import { MailMessage } from "@orz/ui-mail";

// Bytes, so the iso-8859-1 body decodes in its own charset.
const raw = new Uint8Array(await response.arrayBuffer());

<MailMessage raw={raw} />`;

/**
 * A mail message from its raw text or bytes: the header, the body as plain text or HTML, and the
 * attachments, which open in a viewer of their own over the message and are drawn by the app's
 * renderers, so a patch is a diff.
 */
const meta = {
  title: "ui-mail/MailMessage",
  component: MailMessage,
  args: { raw: SERIES_EML },
  decorators: [withWidth("max-w-3xl"), withRenderers(...ATTACHMENT_RENDERERS)],
} satisfies Meta<typeof MailMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A patch series' cover letter, with a plain and an HTML body, two patches, a screenshot and a HAR. */
export const Playground: Story = {};

/** HTML only: no switch, an inline image by Content-ID, and a remote pixel that is not loaded. */
export const HtmlOnly: Story = {
  args: { raw: HTML_ONLY_EML },
};

/** A `format=flowed` body wraps at the reader's width; quoted lines are muted. */
export const Flowed: Story = {
  args: { raw: FLOWED_EML },
};

/** Encoded words in the header, and an 8bit iso-8859-1 body read from its bytes. */
export const Encoded: Story = {
  args: { raw: ENCODED_EML_BYTES },
  parameters: {
    docs: { source: { code: ENCODED_SNIPPET, language: "tsx" } },
  },
};

/** The same message as a string: the 8bit body was decoded once already, and garbles. */
export const EncodedAsString: Story = {
  tags: ["edge", "!autodocs"],
  args: { raw: ENCODED_EML },
};

/** Text that is not a message. */
export const Malformed: Story = {
  tags: ["edge", "!autodocs"],
  args: { raw: "This is a note someone saved with the wrong extension.\n" },
};

/** Headers and nothing else. */
export const NoBody: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    raw: "From: alice <noreply@example.com>\r\nSubject: Empty\r\n\r\n",
  },
};
