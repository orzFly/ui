import { Kbd } from "@orz/ui/components/kbd";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "ui/Primitives/Kbd",
  component: Kbd,
  parameters: { guidelines: "/guidelines/platforms/desktop-and-pointer/" },
  args: { children: "/" },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A key with a modifier is two keys, each its own cap. */
export const Combination: Story = {
  render: (args) => (
    <span className="inline-flex items-center gap-1 text-ui">
      <Kbd {...args}>⇧</Kbd>
      <Kbd {...args}>E</Kbd>
    </span>
  ),
};
