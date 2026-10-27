import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "ui/Primitives/Label",
  component: Label,
  parameters: { guidelines: "/guidelines/patterns/forms/" },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { children: "Email notifications" },
};

export const WithControl: Story = {
  args: { children: "Email notifications" },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Switch id="label-on" />
      <Label {...args} htmlFor="label-on" />
    </div>
  ),
};

export const DisabledPeer: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Switch id="label-off" disabled className="peer" />
      <Label {...args} htmlFor="label-off">
        Dims with a disabled peer
      </Label>
    </div>
  ),
};
