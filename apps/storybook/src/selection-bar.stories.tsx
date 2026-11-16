import { Button } from "@orz/ui/components/button";
import { SelectionBar } from "@orz/ui/components/selection-bar";
import { ToolbarButton } from "@orz/ui/components/toolbar";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ArchiveIcon,
  InboxIcon,
  MailOpenIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { fn } from "storybook/test";
import { argsUpdater } from "./args.ts";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/SelectionBar",
  component: SelectionBar,
  parameters: { guidelines: "/guidelines/patterns/actions-and-buttons/" },
  args: {
    count: 2,
    total: 25,
    onSelectAll: fn(),
    onClear: fn(),
    edge: "bottom",
    idle: (
      <>
        <ToolbarButton aria-label="Refresh">
          <RefreshCwIcon />
        </ToolbarButton>
        <span className="min-w-0 flex-1 truncate px-1 font-medium">Inbox</span>
      </>
    ),
    children: (
      <>
        <ToolbarButton aria-label="Archive">
          <ArchiveIcon />
        </ToolbarButton>
        <ToolbarButton aria-label="Delete">
          <Trash2Icon />
        </ToolbarButton>
        <ToolbarButton aria-label="Mark as read">
          <MailOpenIcon />
        </ToolbarButton>
      </>
    ),
  },
  argTypes: {
    count: { control: { type: "number", min: 0 } },
    total: { control: { type: "number", min: 0 } },
  },
  decorators: [withWidth("w-96")],
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    return (
      <SelectionBar
        {...args}
        onSelectAll={() => {
          args.onSelectAll();
          updateArgs({ count: args.total });
        }}
        onClear={() => {
          args.onClear();
          updateArgs({ count: 0 });
        }}
      />
    );
  },
} satisfies Meta<typeof SelectionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Nothing selected: the checkbox, then the app's own toolbar. */
export const Idle: Story = { args: { count: 0 } };

/** Every row selected, with a text action of the app's after its icons. */
export const AllSelected: Story = {
  args: {
    count: 25,
    children: (
      <>
        <ToolbarButton aria-label="Move to Inbox">
          <InboxIcon />
        </ToolbarButton>
        <Button variant="destructive" size="sm" className="ml-1">
          Delete forever…
        </Button>
      </>
    ),
  },
};
