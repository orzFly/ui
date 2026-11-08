import { Separator } from "@orz/ui/components/separator";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/Primitives/Separator",
  parameters: { guidelines: "/guidelines/foundations/layout-and-spacing/" },
  component: Separator,
  args: { orientation: "horizontal" },
  decorators: [withWidth("max-w-sm")],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="flex h-5 items-center gap-3">
      <span>Left</span>
      <Separator {...args} />
      <span>Right</span>
    </div>
  ),
};

/** Between the rows of one group of controls, which some styles part by space alone. */
export const Row: Story = {
  args: { purpose: "row" },
  render: (args) => (
    <div className="grid">
      <span className="py-3">Wrap long lines</span>
      <Separator {...args} />
      <span className="py-3">Show line numbers</span>
    </div>
  ),
};
