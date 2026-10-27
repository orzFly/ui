import toneUrl from "@orz/fixtures/attachment/tone.ogg?url&no-inline";
import { AudioPlayer } from "@orz/ui-content/attachment";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";

/**
 * An audio file as the shared control bar alone, or under a header. The keys
 * work from any control in the bar.
 */
const meta = {
  title: "ui-content/AudioPlayer",
  component: AudioPlayer,
  parameters: { layout: "padded" },
  args: { src: toneUrl, title: "tone.ogg" },
  decorators: [withWidth("max-w-md")],
} satisfies Meta<typeof AudioPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** `header` sits above the bar; the renderer puts the file's icon, name and Download there. */
export const Header: Story = {
  args: {
    header: (
      <div className="border-b bg-card px-3 py-1 text-card-foreground text-xs">
        tone.ogg
      </div>
    ),
  },
};

/** A source the browser cannot decode, with no `onError`: the message takes the bar's place. */
export const Unsupported: Story = {
  tags: ["edge", "!autodocs"],
  args: { src: "data:audio/x-ms-wma;base64,AAAA", title: "tone.wma" },
};
