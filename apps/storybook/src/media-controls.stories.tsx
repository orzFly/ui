import { MediaControls } from "@orz/ui/components/media-controls";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { fn } from "storybook/test";
import { argsUpdater } from "./args.ts";
import { withWidth } from "./decorators.tsx";

/**
 * The control bar under the cast, video and audio players. It plays nothing
 * itself; here the time advances while Play is on, and the volume follows its
 * controls, so the bar can be tried as a player would drive it.
 */
const meta = {
  title: "ui/MediaControls",
  component: MediaControls,
  parameters: { layout: "padded" },
  args: {
    playing: false,
    time: 42,
    duration: 180,
    speed: 1,
    disabled: false,
    onToggle: fn(),
    onSeek: fn(),
    onSpeed: fn(),
  },
  decorators: [withWidth("max-w-2xl")],
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    // The time moves every frame of a drag and every tick of play, too fast
    // for a round trip through the args.
    const [time, setTime] = useState(args.time);
    useEffect(() => setTime(args.time), [args.time]);
    const [volume, setVolume] = useState(
      args.volume && { level: args.volume.level, muted: args.volume.muted },
    );
    useEffect(
      () =>
        setVolume(
          args.volume && {
            level: args.volume.level,
            muted: args.volume.muted,
          },
        ),
      [args.volume],
    );
    const { playing, speed, duration } = args;
    useEffect(() => {
      if (!playing || !Number.isFinite(duration)) return;
      const interval = setInterval(
        () => setTime((t) => Math.min(t + 0.1 * speed, duration)),
        100,
      );
      return () => clearInterval(interval);
    }, [playing, speed, duration]);
    return (
      <MediaControls
        {...args}
        time={time}
        onToggle={() => updateArgs({ playing: !args.playing })}
        onSeek={setTime}
        onSpeed={(next) => updateArgs({ speed: next })}
        volume={
          volume && {
            ...volume,
            onLevel: (level) => setVolume({ level, muted: false }),
            onMute: () => setVolume({ ...volume, muted: !volume.muted }),
          }
        }
      />
    );
  },
} satisfies Meta<typeof MediaControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: {
    buffered: [[0, 96]],
    volume: { level: 0.8, muted: false, onLevel: fn(), onMute: fn() },
    pictureInPicture: { active: false, onToggle: fn() },
    fullscreen: { active: false, onToggle: fn() },
  },
};

/** Ticks over the track, each a button that seeks to its time. */
export const Markers: Story = {
  args: {
    markers: [
      { time: 12, label: "Install" },
      { time: 75, label: "Build" },
      { time: 140, label: "" },
    ],
  },
};

/** Loaded ranges shaded behind the played range; a seek past them leaves a gap. */
export const Buffered: Story = {
  args: {
    buffered: [
      [0, 70],
      [110, 150],
    ],
  },
};

/** A mute button and a level slider, from 24rem wide. */
export const Volume: Story = {
  args: {
    volume: { level: 0.6, muted: false, onLevel: fn(), onMute: fn() },
  },
};

/** Below 24rem, volume is one button that opens a vertical slider and the mute button. */
export const Narrow: Story = {
  args: {
    volume: { level: 0.6, muted: false, onLevel: fn(), onMute: fn() },
  },
  decorators: [withWidth("max-w-80")],
};

/** A recorded WebM reports no duration until it has been read to the end: the time shows alone. */
export const UnknownDuration: Story = {
  args: { duration: Number.POSITIVE_INFINITY },
};
