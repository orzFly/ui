import { Button } from "@orz/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

/** `TooltipProvider` wraps the app once; the decorator stands in for it. */
const meta = {
  title: "ui/Primitives/Tooltip",
  component: Tooltip,
  args: { onOpenChange: fn() },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  render: (args) => (
    <Tooltip {...args}>
      <TooltipTrigger asChild>
        <Button variant="outline">Hover me</Button>
      </TooltipTrigger>
      <TooltipContent>A short hint</TooltipContent>
    </Tooltip>
  ),
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sides: Story = {
  render: (args) => (
    <div className="flex gap-2 p-10">
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <Tooltip {...args} key={side}>
          <TooltipTrigger asChild>
            <Button variant="outline">{side}</Button>
          </TooltipTrigger>
          <TooltipContent side={side}>Tooltip on the {side}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  ),
};
