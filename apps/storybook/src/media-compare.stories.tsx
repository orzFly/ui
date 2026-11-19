import { SETTINGS_PAIR } from "@orz/fixtures/files.ts";
import { Button } from "@orz/ui/components/button";
import {
  CompareModeProvider,
  type CompareSide,
  MediaCompare,
} from "@orz/ui-content/compare";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { argsUpdater } from "./args.ts";
import { withWidth } from "./decorators.tsx";

const BEFORE: CompareSide = {
  label: "v1",
  content: <img src={SETTINGS_PAIR.before.file.url} alt="Settings, v1" />,
  size: SETTINGS_PAIR.before.size,
};
const AFTER: CompareSide = {
  label: "v2",
  content: <img src={SETTINGS_PAIR.after.file.url} alt="Settings, v2" />,
  size: SETTINGS_PAIR.after.size,
};

const PROVIDER = `import { CompareModeProvider, MediaCompare } from "@orz/ui-content/compare";

// Switching one comparison switches every one below the provider.
<CompareModeProvider>
  <MediaCompare before={before} after={after} />
  <MediaCompare before={before} after={after} />
</CompareModeProvider>`;

const meta = {
  title: "ui-content/MediaCompare",
  component: MediaCompare,
  parameters: { guidelines: "/guidelines/patterns/comparing-images/" },
  args: {
    before: BEFORE,
    after: AFTER,
    align: "start",
    backdrop: "checker",
    onModeChange: fn(),
  },
  argTypes: {
    before: { control: false },
    after: { control: false },
    replacement: { control: false },
    actions: { control: false },
    mode: {
      control: "inline-radio",
      options: ["2up", "swipe", "onion", "diff"],
    },
  },
  decorators: [withWidth("max-w-3xl")],
  render: function Render(args, context) {
    const update = argsUpdater(context);
    return (
      <MediaCompare
        {...args}
        onModeChange={(mode) => {
          args.onModeChange?.(mode);
          if (args.mode !== undefined) update({ mode });
        }}
      />
    );
  },
} satisfies Meta<typeof MediaCompare>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Two versions of a screenshot, side by side at one scale: the newer is
 * taller, and its height is marked in both labels.
 */
export const Playground: Story = {};

/** The newer swiped over the older; drag anywhere on the stage, or use the arrow keys. */
export const Swipe: Story = { args: { mode: "swipe" } };

/** The newer faded over the older, by the slider under the stage. */
export const OnionSkin: Story = { args: { mode: "onion" } };

/** Each pixel's difference: what did not change is black. */
export const Difference: Story = { args: { mode: "diff" } };

/** `modes` limits what is offered; with one there is no mode control. */
export const Modes: Story = { args: { modes: ["2up", "swipe"] } };

/** `title` and `actions` sit in the head beside the modes. */
export const TitleAndActions: Story = {
  args: {
    title: "settings.svg",
    actions: (
      <Button variant="ghost" size="xs">
        Source
      </Button>
    ),
  },
};

/** `onOpen` makes each picture a button, for opening the pair in a viewer. */
export const OnOpen: Story = { args: { onOpen: fn() } };

/** One mode for every comparison under a `CompareModeProvider`. */
export const SharedMode: Story = {
  render: (args) => (
    <CompareModeProvider>
      <div className="grid gap-4">
        <MediaCompare {...args} />
        <MediaCompare {...args} backdrop="page" />
      </div>
    </CompareModeProvider>
  ),
  parameters: { docs: { source: { code: PROVIDER, language: "tsx" } } },
};

/** A side that failed leaves side by side the only mode, the other drawn at its own size. */
export const FailedSide: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    before: { label: "v1", content: null, size: null, failed: true },
  },
};

/** While a side's size is unknown the overlay modes wait, and the boxes are not sized yet. */
export const Loading: Story = {
  tags: ["edge", "!autodocs"],
  args: { after: { ...AFTER, size: null } },
};

/** Long tags are cut, each keeping its whole text as a tooltip. */
export const LongLabels: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    before: { ...BEFORE, label: "Before the settings redesign" },
    after: { ...AFTER, label: "After the settings redesign, with time zone" },
  },
};

/** In a narrow column the panes stack and the mode names shorten. */
export const Narrow: Story = {
  tags: ["edge", "!autodocs"],
  decorators: [withWidth("max-w-xs")],
};
