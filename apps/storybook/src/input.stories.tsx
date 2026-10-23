import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/Primitives/Input",
  component: Input,
  decorators: [withWidth("max-w-sm")],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { placeholder: "Search…", "aria-label": "Search" },
};

export const States: Story = {
  render: (args) => (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="input-default">Default</Label>
        <Input {...args} id="input-default" placeholder="Type here" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="input-invalid">Invalid</Label>
        <Input
          {...args}
          id="input-invalid"
          aria-invalid
          defaultValue="not an email"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="input-disabled">Disabled</Label>
        <Input
          {...args}
          id="input-disabled"
          disabled
          defaultValue="read only"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="input-file">File</Label>
        <Input {...args} id="input-file" type="file" />
      </div>
    </div>
  ),
};
