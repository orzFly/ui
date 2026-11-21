import { InfoPopover } from "@orz/ui/components/info-popover";
import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";
import { TextLink } from "@orz/ui/components/text-link";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/Primitives/InfoPopover",
  component: InfoPopover,
  parameters: { guidelines: "/guidelines/content/writing/" },
  args: {
    onOpenChange: fn(),
    children:
      "Tidies indentation and trailing spaces each time a file is saved.",
  },
} satisfies Meta<typeof InfoPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Right after the label it explains, never at the row's far end with the control. */
export const BesideALabel: Story = {
  decorators: [withWidth("max-w-sm")],
  args: { label: "About format on save" },
  render: (args) => (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1">
        <Label htmlFor="info-popover-format">Format on save</Label>
        <InfoPopover {...args} />
      </div>
      <Switch id="info-popover-format" defaultChecked />
    </div>
  ),
};

/** The explanation may end in a link to where it is told in full. */
export const WithLink: Story = {
  args: {
    label: "About the weekly summary",
    children: (
      <>
        A Monday email of what changed last week, sent even when notifications
        are off. <TextLink href="#">See an example</TextLink>
      </>
    ),
  },
};
