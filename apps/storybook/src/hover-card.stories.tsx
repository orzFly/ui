import { Avatar, AvatarFallback } from "@orz/ui/components/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@orz/ui/components/hover-card";
import { TextLink } from "@orz/ui/components/text-link";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

const meta = {
  title: "ui/Primitives/HoverCard",
  component: HoverCard,
  parameters: { guidelines: "/guidelines/patterns/overlays/" },
  args: { onOpenChange: fn() },
  render: (args) => (
    <HoverCard {...args}>
      <HoverCardTrigger asChild>
        <TextLink href="#alice">@alice</TextLink>
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="flex gap-3">
          <Avatar>
            <AvatarFallback>AL</AvatarFallback>
          </Avatar>
          <div className="grid gap-1">
            <h3>alice</h3>
            <p>
              Hover cards cap their 28rem width to what the viewport offers.
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
} satisfies Meta<typeof HoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
