import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@orz/ui/components/popover";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "ui/Primitives/Popover",
  component: Popover,
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Set width</Button>
      </PopoverTrigger>
      <PopoverContent className="grid gap-2 p-3">
        <Label htmlFor="popover-width">Width</Label>
        <Input id="popover-width" defaultValue="100%" />
        <PopoverClose asChild>
          <Button size="sm" className="justify-self-end">
            Done
          </Button>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  ),
};

export const LongList: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Pick a label</Button>
      </PopoverTrigger>
      <PopoverContent>
        {Array.from({ length: 60 }, (_, i) => (
          <Button
            // biome-ignore lint/suspicious/noArrayIndexKey: static filler rows
            key={i}
            variant="ghost"
            className="w-full justify-start"
          >
            label-{i + 1}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  ),
};
