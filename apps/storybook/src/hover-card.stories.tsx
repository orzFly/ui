import { Avatar, AvatarFallback } from "@orz/ui/components/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@orz/ui/components/hover-card";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Primitives/HoverCard",
  component: HoverCard,
} satisfies Meta<typeof HoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <a href="#alice" className="underline underline-offset-4">
          @alice
        </a>
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="flex gap-3">
          <Avatar>
            <AvatarFallback>AL</AvatarFallback>
          </Avatar>
          <div className="grid gap-1">
            <div className="font-medium">alice</div>
            <p className="text-muted-foreground">
              Hover cards cap their 28rem width to what the viewport offers.
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};
