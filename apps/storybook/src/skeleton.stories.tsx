import { Skeleton } from "@orz/ui/components/skeleton";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/Primitives/Skeleton",
  component: Skeleton,
  parameters: { guidelines: "/guidelines/patterns/loading-empty-and-error/" },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { className: "h-4 w-48" },
};

export const Row: Story = {
  decorators: [withWidth("max-w-sm")],
  render: (args) => (
    <div className="flex items-center gap-3">
      <Skeleton {...args} className="size-8 rounded-full" />
      <div className="grid flex-1 gap-2">
        <Skeleton {...args} className="h-4 w-3/4" />
        <Skeleton {...args} className="h-4 w-1/2" />
      </div>
    </div>
  ),
};
