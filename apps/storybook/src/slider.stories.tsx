import { Slider } from "@orz/ui/components/slider";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/Primitives/Slider",
  component: Slider,
  parameters: { guidelines: "/guidelines/patterns/choosing-a-control/" },
  args: { "aria-label": "Volume" },
  decorators: [withWidth("w-64")],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { defaultValue: [40] },
};

/** A controlled slider on half steps; the `value` control moves the thumb. */
export const Stepped: Story = {
  args: { "aria-label": "Speed", value: [2], min: 0.5, max: 4, step: 0.5 },
  // Local state, not `updateArgs`: a drag must not wait on the round trip.
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    useEffect(() => setValue(args.value), [args.value]);
    return <Slider {...args} value={value} onValueChange={setValue} />;
  },
};

export const Range: Story = {
  args: { "aria-label": "Range", defaultValue: [20, 80] },
};

export const Disabled: Story = {
  args: { defaultValue: [40], disabled: true },
};
