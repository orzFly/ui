import { AsciinemaPlayer } from "@orz/ui-asciinema";
import type { Meta, StoryObj } from "@storybook/react-vite";
import session from "./fixtures/asciinema/session.cast?raw";
import sessionV3 from "./fixtures/asciinema/session-v3.cast?raw";

/**
 * A recording played in the terminal slot's colours: pick a Terminal theme
 * from the toolbar while it plays. The final frame shows until play, which
 * starts from 0:00; the ticks on the track are the cast's markers, `[` and
 * `]` step between them, and `f` puts the whole frame in fullscreen.
 */
const meta = {
  title: "ui-asciinema/AsciinemaPlayer",
  component: AsciinemaPlayer,
  parameters: { layout: "padded" },
  args: { cast: session, className: "max-w-3xl" },
  argTypes: { cast: { control: false } },
} satisfies Meta<typeof AsciinemaPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** asciicast v2, with an idle gap the cast caps at 2 s and two markers. */
export const Default: Story = {};

export const Speed2x: Story = {
  name: "Speed 2×",
  args: { speed: 2 },
};

/** The same session as asciicast v3, which carries no markers: no ticks. */
export const NoMarkers: Story = {
  args: { cast: sessionV3 },
};
