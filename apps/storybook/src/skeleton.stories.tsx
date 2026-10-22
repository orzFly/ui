import { Skeleton } from "@orz/ui/components/skeleton";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Primitives/Skeleton",
  component: Skeleton,
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Row: Story = {
  render: () => (
    <div className="flex max-w-sm items-center gap-3">
      <Skeleton className="size-8 rounded-full" />
      <div className="grid flex-1 gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  ),
};
