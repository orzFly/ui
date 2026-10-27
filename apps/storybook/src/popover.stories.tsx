import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import {
  Popover,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@orz/ui/components/popover";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/Primitives/Popover",
  component: Popover,
  parameters: { guidelines: "/guidelines/patterns/overlays/" },
  args: { onOpenChange: fn() },
  render: (args) => (
    <Popover {...args}>
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
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const LongList: Story = {
  render: (args) => (
    <Popover {...args}>
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

/** Opens against an element that is not its trigger: here, an input on focus. */
export const Anchor: Story = {
  decorators: [withWidth("max-w-sm")],
  render: function Render(args) {
    const [open, setOpen] = useState(false);
    return (
      <Popover
        {...args}
        open={open}
        onOpenChange={(o) => {
          args.onOpenChange?.(o);
          setOpen(o);
        }}
      >
        <PopoverAnchor asChild>
          <Input
            aria-label="Label"
            placeholder="Focus to open"
            onFocus={() => setOpen(true)}
          />
        </PopoverAnchor>
        <PopoverContent onOpenAutoFocus={(e) => e.preventDefault()}>
          Positioned against the input, with no trigger.
        </PopoverContent>
      </Popover>
    );
  },
};
