import { binary } from "@orz/fixtures/files.ts";
import { syntheticBytes } from "@orz/fixtures/hex.ts";
import { Content } from "@orz/ui-content";
import type { FileSource } from "@orz/ui-content/attachment";
import { HEX_PREVIEW_MAX_BYTES, hexContent } from "@orz/ui-hex/content";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { withRenderers, withWidth } from "./decorators.tsx";
import { registrationSnippet } from "./snippets.ts";

const BYTES = syntheticBytes(12 * 1024);
const CACHE = binary(
  "cache.bin",
  "application/octet-stream",
  URL.createObjectURL(new Blob([BYTES])),
  BYTES.length,
);

// The viewer sets the pane's height; on a docs page this stands in for it.
const paneHeight: Decorator = (Story) => (
  <div style={{ "--attachment-pane-height": "24rem" } as CSSProperties}>
    <Story />
  </div>
);

/**
 * `hexContent` in the registry: in a viewer, a binary file that no renderer
 * before it takes is fetched and drawn as a hex dump. Over 64 MiB it stays a
 * download, and in a document it is always a link.
 */
const meta = {
  title: "ui-hex/Content",
  parameters: {
    layout: "padded",
    docs: {
      source: {
        code: registrationSnippet({
          renderers: [["@orz/ui-hex/content", "hexContent"]],
          uses: [["@orz/ui-content", "Content"]],
          body: '<Content source={file} placement="viewer" />',
        }),
        language: "tsx",
      },
    },
  },
  decorators: [paneHeight, withWidth("max-w-3xl"), withRenderers(hexContent)],
  render: (args) => <Content source={args.source} placement="viewer" />,
} satisfies Meta<{ source: FileSource }>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Hex: Story = {
  args: { source: CACHE },
};

export const TooLarge: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    source: { ...CACHE, name: "huge.bin", size: HEX_PREVIEW_MAX_BYTES + 1 },
  },
};
