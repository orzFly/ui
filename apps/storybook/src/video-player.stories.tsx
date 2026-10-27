import clipUrl from "@orz/fixtures/attachment/clip.webm?url&no-inline";
import { VideoPlayer } from "@orz/ui-content/attachment";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";

/**
 * A video under the shared control bar. Focus the picture and use Space or
 * `k`, ← →, `0`–`9`, `m` and `f`; fullscreen keeps the bar.
 */
const meta = {
  title: "ui-content/VideoPlayer",
  component: VideoPlayer,
  parameters: { layout: "padded" },
  args: { src: clipUrl, title: "clip.webm" },
  decorators: [withWidth("max-w-2xl")],
} satisfies Meta<typeof VideoPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** `header` sits above the picture; the renderer puts the name and Download there. */
export const Header: Story = {
  args: {
    header: (
      <div className="border-b bg-card px-3 py-1 text-card-foreground text-xs">
        clip.webm
      </div>
    ),
  },
};

/** A source the browser cannot decode, with no `onError`: the player says so. */
export const Unsupported: Story = {
  tags: ["edge", "!autodocs"],
  args: { src: "data:video/x-msvideo;base64,AAAA", title: "clip.avi" },
};
