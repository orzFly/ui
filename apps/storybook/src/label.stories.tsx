import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Primitives/Label",
  component: Label,
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithControl: Story = {
  render: () => (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Switch id="label-on" />
        <Label htmlFor="label-on">Email notifications</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="label-off" disabled className="peer" />
        <Label htmlFor="label-off">Dims with a disabled peer</Label>
      </div>
    </div>
  ),
};
