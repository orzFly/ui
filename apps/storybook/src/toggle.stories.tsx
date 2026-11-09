import { Toggle } from "@orz/ui/components/toggle";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { argsUpdater } from "./args.ts";

const meta = {
  title: "ui/Primitives/Toggle",
  component: Toggle,
  parameters: { guidelines: "/guidelines/patterns/choosing-a-control/" },
  args: {
    pressed: true,
    onPressedChange: fn(),
    children: "#design",
  },
  render: function Render(args, context) {
    const update = argsUpdater(context);
    return (
      <Toggle
        {...args}
        onPressedChange={(pressed) => {
          args.onPressedChange?.(pressed);
          update({ pressed });
        }}
      />
    );
  },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Each tag is on or off on its own; any number may be on at once. */
export const Tags: Story = {
  render: (args) => (
    <fieldset aria-label="Tags" className="flex flex-wrap gap-1">
      <Toggle {...args} defaultPressed>
        #ci
      </Toggle>
      <Toggle {...args}>#design</Toggle>
      <Toggle {...args} defaultPressed>
        #fetch
      </Toggle>
    </fieldset>
  ),
  args: { pressed: undefined },
};

/** A tag that narrows nothing right now is disabled, and the rest stay pressable. */
export const Disabled: Story = {
  args: { disabled: true, pressed: false },
};
