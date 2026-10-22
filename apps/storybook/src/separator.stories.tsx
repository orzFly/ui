import { Separator } from "@orz/ui/components/separator";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Primitives/Separator",
  component: Separator,
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Orientations: Story = {
  render: () => (
    <div className="grid max-w-sm gap-3">
      <div>Above</div>
      <Separator />
      <div className="flex h-5 items-center gap-3">
        <span>Left</span>
        <Separator orientation="vertical" />
        <span>Right</span>
      </div>
    </div>
  ),
};
