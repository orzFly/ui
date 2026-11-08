import {
  SegmentedControl,
  SegmentedControlItem,
} from "@orz/ui/components/segmented-control";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { argsUpdater } from "./args.ts";

const meta = {
  title: "ui/Primitives/SegmentedControl",
  component: SegmentedControl,
  parameters: { guidelines: "/guidelines/patterns/choosing-a-control/" },
  args: {
    "aria-label": "Typing",
    value: "overwrite",
    onValueChange: fn(),
  },
  render: function Render(args, context) {
    const update = argsUpdater(context);
    return (
      <SegmentedControl
        {...args}
        onValueChange={(value) => {
          args.onValueChange?.(value);
          update({ value });
        }}
      >
        <SegmentedControlItem value="overwrite">Overwrite</SegmentedControlItem>
        <SegmentedControlItem value="insert">Insert</SegmentedControlItem>
      </SegmentedControl>
    );
  },
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A mode the tool cannot take right now is disabled, and the rest stay pressable. */
export const Disabled: Story = {
  render: (args) => (
    <SegmentedControl {...args}>
      <SegmentedControlItem value="overwrite">Overwrite</SegmentedControlItem>
      <SegmentedControlItem value="insert" disabled>
        Insert
      </SegmentedControlItem>
    </SegmentedControl>
  ),
};
