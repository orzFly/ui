import { asciinemaContent, CAST_MAX_BYTES } from "@orz/ui-asciinema";
import { Content } from "@orz/ui-content";
import type { FileSource } from "@orz/ui-content/attachment";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRenderers, withWidth } from "./decorators.tsx";
import broken from "./fixtures/asciinema/broken.cast?raw";
import session from "./fixtures/asciinema/session.cast?raw";
import { textFile } from "./fixtures/files.ts";
import { registrationSnippet } from "./snippets.ts";

/**
 * `asciinemaContent` in the registry: a `.cast` file plays under a strip with
 * its title and a Download link. Over 16 MiB it stays a download, and a cast
 * that does not scan goes on to the next renderer — here the fallback link —
 * with the reason under it.
 */
const meta = {
  title: "ui-asciinema/Content",
  parameters: {
    layout: "padded",
    docs: {
      source: {
        code: registrationSnippet({
          renderers: [["@orz/ui-asciinema", "asciinemaContent"]],
          uses: [["@orz/ui-content", "Content"]],
          body: '<Content source={file} placement="document" />',
        }),
        language: "tsx",
      },
    },
  },
  decorators: [withWidth("max-w-3xl"), withRenderers(asciinemaContent)],
  render: (args) => <Content source={args.source} placement="document" />,
} satisfies Meta<{ source: FileSource }>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Asciinema: Story = {
  args: {
    source: textFile("session.cast", "application/x-asciicast", session),
  },
};

export const TooLarge: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    source: {
      ...textFile("huge-session.cast", "application/x-asciicast", session),
      size: CAST_MAX_BYTES + 1,
    },
  },
};

export const Broken: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    source: textFile("broken.cast", "application/x-asciicast", broken),
  },
};
