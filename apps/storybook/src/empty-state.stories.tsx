import { Button } from "@orz/ui/components/button";
import { EmptyState } from "@orz/ui/components/empty-state";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { InboxIcon, NotebookIcon, PlusIcon } from "lucide-react";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/EmptyState",
  component: EmptyState,
  parameters: { guidelines: "/guidelines/patterns/loading-empty-and-error/" },
  args: {
    icon: NotebookIcon,
    title: "No notes yet",
    children:
      "A note is markdown, kept in this tab. Start one with a # heading.",
    action: (
      <Button variant="outline" size="sm">
        <PlusIcon />
        New note
      </Button>
    ),
  },
  decorators: [withWidth("max-w-sm")],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A filter that hides everything says so, and offers to clear it rather than to add one. */
export const NothingMatches: Story = {
  args: {
    title: "No notes match",
    children: "Try fewer words, or fewer tags.",
    action: (
      <Button variant="outline" size="sm">
        Clear filter
      </Button>
    ),
  },
};

/** A place that fills by itself has no next step to offer: only what lands here. */
export const WithoutAction: Story = {
  args: {
    icon: InboxIcon,
    title: "Nothing in Archive",
    children: "Archived conversations leave the inbox and wait here.",
    action: undefined,
  },
};
