import { Label } from "@orz/ui/components/label";
import { NumberInput } from "@orz/ui/components/number-input";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { fn } from "storybook/test";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/Primitives/NumberInput",
  component: NumberInput,
  parameters: { guidelines: "/guidelines/patterns/choosing-a-control/" },
  args: { "aria-label": "Recent files", defaultValue: 8, min: 0, max: 30 },
  decorators: [withWidth("w-32")],
} satisfies Meta<typeof NumberInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * Controlled; the `value` control sets it. Local state, not `updateArgs`: a
 * held step button repeats faster than the round trip.
 */
export const Controlled: Story = {
  args: {
    defaultValue: undefined,
    value: 13,
    min: 8,
    max: 32,
    onValueChange: fn(),
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    useEffect(() => setValue(args.value), [args.value]);
    return (
      <NumberInput
        {...args}
        value={value}
        onValueChange={(next) => {
          args.onValueChange?.(next);
          setValue(next);
        }}
      />
    );
  },
};

/** Values snap to `step` from `min`; Page Up and Page Down move by `largeStep`. */
export const Step: Story = {
  args: {
    "aria-label": "Speed",
    defaultValue: 1,
    min: 0.25,
    max: 4,
    step: 0.25,
    largeStep: 1,
  },
};

export const States: Story = {
  render: (args) => (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="number-input-invalid">Invalid</Label>
        <NumberInput
          {...args}
          aria-label={undefined}
          id="number-input-invalid"
          aria-invalid
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="number-input-disabled">Disabled</Label>
        <NumberInput
          {...args}
          aria-label={undefined}
          id="number-input-disabled"
          disabled
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="number-input-max">At its maximum</Label>
        <NumberInput
          {...args}
          aria-label={undefined}
          id="number-input-max"
          defaultValue={args.max}
        />
      </div>
    </div>
  ),
};
