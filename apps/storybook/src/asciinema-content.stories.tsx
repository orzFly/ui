import { asciinemaContent, CAST_MAX_BYTES } from "@orz/ui-asciinema";
import { Content, ContentRenderers, type ContentSource } from "@orz/ui-content";
import type { Meta, StoryObj } from "@storybook/react-vite";
import broken from "./fixtures/asciinema/broken.cast?raw";
import session from "./fixtures/asciinema/session.cast?raw";
import sessionUrl from "./fixtures/asciinema/session.cast?url&no-inline";

type FileSource = Extract<ContentSource, { kind: "file" }>;

/**
 * `asciinemaContent` in the registry: a `.cast` file plays under a strip with
 * its title and a Download link. Over 16 MiB it stays a download, and a cast
 * that does not scan goes on to the next renderer — here the fallback link —
 * with the reason under it.
 */
const meta = {
  title: "ui-asciinema/Content",
  parameters: { layout: "padded" },
  render: (args: { source: FileSource }) => (
    <div className="max-w-3xl">
      <ContentRenderers renderers={[asciinemaContent]}>
        <Content source={args.source} placement="document" />
      </ContentRenderers>
    </div>
  ),
} satisfies Meta<{ source: FileSource }>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlayingFile: Story = {
  name: "File",
  args: {
    source: {
      kind: "file",
      name: "session.cast",
      mime: "application/x-asciicast",
      size: session.length,
      url: sessionUrl,
      load: async () => session,
    },
  },
};

export const TooLarge: Story = {
  name: "Over the cap",
  args: {
    source: {
      kind: "file",
      name: "huge-session.cast",
      size: CAST_MAX_BYTES + 1,
      url: sessionUrl,
      load: async () => session,
    },
  },
};

export const Broken: Story = {
  args: {
    source: {
      kind: "file",
      name: "broken.cast",
      size: broken.length,
      url: URL.createObjectURL(
        new Blob([broken], { type: "application/x-asciicast" }),
      ),
      load: async () => broken,
    },
  },
};
