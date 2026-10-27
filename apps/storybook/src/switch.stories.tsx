import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "ui/Primitives/Switch",
  component: Switch,
  parameters: { guidelines: "/guidelines/patterns/choosing-a-control/" },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { "aria-label": "Toggle" },
};

export const States: Story = {
  render: (args) => (
    <div className="grid gap-3">
      {(
        [
          ["switch-off", "Off", {}],
          ["switch-on", "On", { defaultChecked: true }],
          ["switch-disabled", "Disabled", { disabled: true }],
          [
            "switch-disabled-on",
            "Disabled, on",
            { disabled: true, defaultChecked: true },
          ],
        ] as const
      ).map(([id, label, props]) => (
        <div key={id} className="flex items-center gap-2">
          <Switch {...args} id={id} {...props} />
          <Label htmlFor={id}>{label}</Label>
        </div>
      ))}
    </div>
  ),
};
