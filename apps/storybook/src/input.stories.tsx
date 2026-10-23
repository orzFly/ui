import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "ui/Primitives/Input",
  component: Input,
  args: { placeholder: "Search…", "aria-label": "Search" },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
  render: () => (
    <div className="grid max-w-sm gap-4">
      <div className="grid gap-2">
        <Label htmlFor="input-default">Default</Label>
        <Input id="input-default" placeholder="Type here" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="input-invalid">Invalid</Label>
        <Input id="input-invalid" aria-invalid defaultValue="not an email" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="input-disabled">Disabled</Label>
        <Input id="input-disabled" disabled defaultValue="read only" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="input-file">File</Label>
        <Input id="input-file" type="file" />
      </div>
    </div>
  ),
};
