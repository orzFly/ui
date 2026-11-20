import { Button } from "@orz/ui/components/button";
import { EmptyState } from "@orz/ui/components/empty-state";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  InboxIcon,
  LockIcon,
  NotebookIcon,
  PlusIcon,
  ServerCrashIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/EmptyState",
  component: EmptyState,
  parameters: { guidelines: "/guidelines/patterns/loading-empty-and-error/" },
  args: {
    // Widened so a story can pass an element: the meta's own value would
    // narrow every story's `icon` to a component.
    icon: NotebookIcon as ComponentProps<typeof EmptyState>["icon"],
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

/**
 * Among other content (a section of a settings page, a sidebar group, the body of a card) the
 * state sits on one row: the icon beside the title, the action at the end. On a narrow row the
 * action wraps under the text.
 */
export const Horizontal: Story = {
  args: {
    orientation: "horizontal",
    icon: LockIcon,
    title: "No access to deploy keys",
    children: undefined,
    action: (
      <Button variant="outline" size="sm">
        Request access
      </Button>
    ),
  },
  decorators: [withWidth("max-w-lg")],
};

/** An element in `icon` is drawn as it is: the caller sizes and colours it. */
export const CustomVisual: Story = {
  args: {
    icon: (
      <svg
        aria-hidden
        viewBox="0 0 64 48"
        className="h-12 w-16 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="14" y="4" width="36" height="40" rx="2" />
        <path d="M22 16h20M22 23h20M22 30h12" />
        <path d="M4 40h56" strokeDasharray="3 3" />
      </svg>
    ),
    title: "No notes yet",
  },
};

/**
 * A place with nothing to show because its read failed: the title says what failed, the
 * description carries the server's own words, and the action retries.
 */
export const Destructive: Story = {
  args: {
    tone: "destructive",
    icon: ServerCrashIcon,
    title: "Couldn't load your notes",
    children: "503 Service Unavailable",
    action: (
      <Button variant="outline" size="sm">
        Retry
      </Button>
    ),
  },
};
