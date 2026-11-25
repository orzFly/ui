import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@orz/ui/components/dropdown-menu";
import { Kbd } from "@orz/ui/components/kbd";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@orz/ui/components/segmented-control";
import {
  SplitButton,
  SplitButtonAction,
  SplitButtonMenu,
} from "@orz/ui/components/split-button";
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarItem,
  ToolbarLabel,
  ToolbarMenu,
  ToolbarOverflow,
  ToolbarSearch,
  ToolbarSeparator,
  ToolbarSpacer,
} from "@orz/ui/components/toolbar";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ArchiveIcon,
  ArrowLeftIcon,
  BoldIcon,
  CircleDotIcon,
  CodeIcon,
  ForwardIcon,
  GitMergeIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  MailIcon,
  PlusIcon,
  ReplyAllIcon,
  ReplyIcon,
  SendIcon,
  StarIcon,
  TableIcon,
  TagIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react";
import { useState } from "react";

// A box the reader can drag narrower and wider by its corner, starting at
// `width`: what a toolbar fits follows its box, not the window.
function withResizable(width: number): Decorator {
  return (Story) => (
    <div
      className="min-w-40 max-w-full resize-x overflow-hidden rounded-surface border border-dashed p-px"
      style={{ width }}
    >
      <Story />
    </div>
  );
}

const meta = {
  title: "ui/Toolbar",
  component: Toolbar,
  parameters: { guidelines: "/guidelines/patterns/toolbars/" },
  args: {
    "aria-label": "Formatting",
    edge: "bottom",
    children: (
      <>
        <ToolbarGroup
          label="Text style"
          selection="multiple"
          defaultValue={["bold"]}
        >
          <ToolbarButton value="bold" aria-label="Bold" shortcut="Ctrl B">
            <BoldIcon />
          </ToolbarButton>
          <ToolbarButton value="italic" aria-label="Italic" shortcut="Ctrl I">
            <ItalicIcon />
          </ToolbarButton>
          <ToolbarButton value="code" aria-label="Code">
            <CodeIcon />
          </ToolbarButton>
        </ToolbarGroup>
        <ToolbarSeparator />
        <ToolbarGroup label="Alignment" selection="single" defaultValue="left">
          <ToolbarButton value="left" aria-label="Align left">
            <AlignLeftIcon />
          </ToolbarButton>
          <ToolbarButton value="center" aria-label="Align center">
            <AlignCenterIcon />
          </ToolbarButton>
          <ToolbarButton value="right" aria-label="Align right">
            <AlignRightIcon />
          </ToolbarButton>
        </ToolbarGroup>
        <ToolbarSeparator />
        <ToolbarButton>
          <LinkIcon />
          <ToolbarLabel>Link</ToolbarLabel>
        </ToolbarButton>
        <ToolbarButton>
          <ImageIcon />
          <ToolbarLabel>Image</ToolbarLabel>
        </ToolbarButton>
        <ToolbarButton>
          <TableIcon />
          <ToolbarLabel>Table</ToolbarLabel>
        </ToolbarButton>
      </>
    ),
  },
  argTypes: {
    children: { control: false },
    size: { control: "inline-radio", options: ["sm", "default"] },
    labelCollapse: { control: "inline-radio", options: ["auto", "never"] },
    overflowAlign: { control: "inline-radio", options: ["start", "end"] },
  },
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { decorators: [withResizable(560)] };

/**
 * A `ToolbarSpacer` splits the bar into two clusters: the one before it gives
 * up its parts first, from its end, and the ⋯ stands where it ended, so the
 * cluster at the far end keeps its place. A `ToolbarMenu` follows its
 * command into the ⋯ menu as a submenu.
 */
export const SplitAlignment: Story = {
  args: {
    "aria-label": "Thread actions",
    children: (
      <>
        <ToolbarButton aria-label="Archive">
          <ArchiveIcon />
        </ToolbarButton>
        <ToolbarButton aria-label="Delete">
          <Trash2Icon />
        </ToolbarButton>
        <ToolbarButton aria-label="Mark as unread">
          <MailIcon />
        </ToolbarButton>
        <ToolbarMenu icon={<TagIcon />} label="Labels" iconOnly>
          <DropdownMenuLabel>Labels</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked>design</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem>docs</DropdownMenuCheckboxItem>
        </ToolbarMenu>
        <ToolbarSpacer />
        <ToolbarButton aria-label="Star" aria-pressed>
          <StarIcon className="fill-current" />
        </ToolbarButton>
        <ToolbarButton variant="default">
          <ReplyIcon />
          <ToolbarLabel>Reply</ToolbarLabel>
        </ToolbarButton>
      </>
    ),
  },
  decorators: [withResizable(420)],
};

/**
 * On a fine pointer the words of commands with an icon hide before any
 * command moves, the lowest `priority` first, each priority all at once;
 * their tooltips say them. A primary command keeps its words. On a coarse
 * pointer, where no tooltip shows, nothing hides: commands move into the ⋯
 * menu, words and all.
 */
export const LabelCollapse: Story = {
  args: {
    "aria-label": "Message",
    children: (
      <>
        <ToolbarButton shortcut="R">
          <ReplyIcon />
          <ToolbarLabel>Reply</ToolbarLabel>
        </ToolbarButton>
        <ToolbarButton>
          <ReplyAllIcon />
          <ToolbarLabel>Reply all</ToolbarLabel>
        </ToolbarButton>
        <ToolbarButton priority={-1}>
          <ForwardIcon />
          <ToolbarLabel>Forward</ToolbarLabel>
        </ToolbarButton>
        <ToolbarButton priority={-1}>
          <ArchiveIcon />
          <ToolbarLabel>Archive</ToolbarLabel>
        </ToolbarButton>
        <ToolbarSpacer />
        <ToolbarButton variant="default">
          <SendIcon />
          <ToolbarLabel>Send</ToolbarLabel>
        </ToolbarButton>
      </>
    ),
  },
  decorators: [withResizable(480)],
};

/**
 * A search narrows first, then, while empty, gives way to its icon; pressed,
 * it opens again and other parts make room. Filters set away from their
 * defaults go into the ⋯ menu last, and are counted on it while they are
 * there.
 */
export const SearchAndFilters: Story = {
  render: function Render(args) {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("open");
    const [owner, setOwner] = useState("anyone");
    return (
      <Toolbar {...args}>
        <ToolbarSearch
          label="Search issues"
          placeholder="Search…"
          value={query}
          onValueChange={setQuery}
        />
        <ToolbarMenu
          icon={<CircleDotIcon />}
          label="Status"
          value={status === "open" ? "Open" : "Closed"}
          active={status !== "open"}
        >
          <DropdownMenuRadioGroup value={status} onValueChange={setStatus}>
            <DropdownMenuRadioItem value="open">Open</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="closed">Closed</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </ToolbarMenu>
        <ToolbarMenu
          icon={<UserIcon />}
          label="Owner"
          value={owner === "anyone" ? "Anyone" : "Me"}
          active={owner !== "anyone"}
        >
          <DropdownMenuRadioGroup value={owner} onValueChange={setOwner}>
            <DropdownMenuRadioItem value="anyone">Anyone</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="me">Me</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </ToolbarMenu>
        <ToolbarSpacer />
        <ToolbarButton variant="default" priority="pin">
          <PlusIcon />
          <ToolbarLabel>New issue</ToolbarLabel>
        </ToolbarButton>
      </Toolbar>
    );
  },
  args: { "aria-label": "Issues", size: "sm" },
  decorators: [withResizable(640)],
};

/**
 * Both filters set away from their defaults and in the ⋯ menu: the ⋯ counts
 * them, and their rows in the menu are marked before their values.
 */
export const ActiveInOverflow: Story = {
  render: function Render(args) {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("closed");
    const [owner, setOwner] = useState("me");
    return (
      <Toolbar {...args}>
        <ToolbarSearch
          label="Search issues"
          placeholder="Search…"
          value={query}
          onValueChange={setQuery}
        />
        <ToolbarMenu
          icon={<CircleDotIcon />}
          label="Status"
          value={status === "open" ? "Open" : "Closed"}
          active={status !== "open"}
        >
          <DropdownMenuRadioGroup value={status} onValueChange={setStatus}>
            <DropdownMenuRadioItem value="open">Open</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="closed">Closed</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </ToolbarMenu>
        <ToolbarMenu
          icon={<UserIcon />}
          label="Owner"
          value={owner === "anyone" ? "Anyone" : "Me"}
          active={owner !== "anyone"}
        >
          <DropdownMenuRadioGroup value={owner} onValueChange={setOwner}>
            <DropdownMenuRadioItem value="anyone">Anyone</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="me">Me</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </ToolbarMenu>
        <ToolbarSpacer />
        <ToolbarButton variant="default" priority="pin">
          <PlusIcon />
          <ToolbarLabel>New issue</ToolbarLabel>
        </ToolbarButton>
      </Toolbar>
    );
  },
  args: { "aria-label": "Issues", size: "sm" },
  decorators: [withResizable(200)],
};

/**
 * Two ways to choose one of a few: a `SegmentedControl` becomes a dropdown of
 * its value before anything moves, then radio items in the ⋯ menu; a
 * `ToolbarGroup` with `selection="single"` stays a row of toggles until it
 * moves into the menu whole.
 */
export const SegmentedAndGroups: Story = {
  render: function Render(args) {
    const [view, setView] = useState("list");
    const [align, setAlign] = useState("left");
    return (
      <Toolbar {...args}>
        <SegmentedControl
          aria-label="View"
          value={view}
          onValueChange={setView}
          toolbarActive={view !== "list"}
        >
          <SegmentedControlItem value="list">List</SegmentedControlItem>
          <SegmentedControlItem value="board">Board</SegmentedControlItem>
          <SegmentedControlItem value="calendar">Calendar</SegmentedControlItem>
        </SegmentedControl>
        <ToolbarSeparator />
        <ToolbarGroup
          label="Alignment"
          selection="single"
          value={align}
          onValueChange={setAlign}
        >
          <ToolbarButton value="left" aria-label="Align left">
            <AlignLeftIcon />
          </ToolbarButton>
          <ToolbarButton value="center" aria-label="Align center">
            <AlignCenterIcon />
          </ToolbarButton>
          <ToolbarButton value="right" aria-label="Align right">
            <AlignRightIcon />
          </ToolbarButton>
        </ToolbarGroup>
        <ToolbarButton aria-label="List">
          <ListIcon />
        </ToolbarButton>
      </Toolbar>
    );
  },
  args: { "aria-label": "Layout" },
  decorators: [withResizable(400)],
};

/**
 * A `SplitButton` on the bar is flat as its commands are; in the ⋯ menu its
 * command is an item and its variants a submenu.
 */
export const SplitButtons: Story = {
  args: {
    "aria-label": "Pull request",
    children: (
      <>
        <ToolbarButton aria-label="Back">
          <ArrowLeftIcon />
        </ToolbarButton>
        <ToolbarSpacer />
        <ToolbarButton>
          <CodeIcon />
          <ToolbarLabel>Files</ToolbarLabel>
        </ToolbarButton>
        <SplitButton>
          <SplitButtonAction>
            <GitMergeIcon />
            <ToolbarLabel>Merge</ToolbarLabel>
          </SplitButtonAction>
          <SplitButtonMenu triggerLabel="Merge options">
            <DropdownMenuItem>Squash and merge</DropdownMenuItem>
            <DropdownMenuItem>Rebase and merge</DropdownMenuItem>
          </SplitButtonMenu>
        </SplitButton>
      </>
    ),
  },
  decorators: [withResizable(360)],
};

/**
 * A `ToolbarOverflow` with items of its own shows the ⋯ always; what the bar
 * moves into it goes above them.
 */
export const PermanentOverflow: Story = {
  args: {
    "aria-label": "Thread actions",
    children: (
      <>
        <ToolbarButton aria-label="Archive">
          <ArchiveIcon />
        </ToolbarButton>
        <ToolbarButton aria-label="Delete">
          <Trash2Icon />
        </ToolbarButton>
        <ToolbarButton aria-label="Mark as unread">
          <MailIcon />
        </ToolbarButton>
        <ToolbarSpacer />
        <ToolbarButton aria-label="Star">
          <StarIcon />
        </ToolbarButton>
        <ToolbarOverflow>
          <DropdownMenuItem>
            <ForwardIcon />
            Forward
          </DropdownMenuItem>
          <DropdownMenuItem>
            <LinkIcon />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <Trash2Icon />
            Delete forever…
          </DropdownMenuItem>
        </ToolbarOverflow>
      </>
    ),
  },
  decorators: [withResizable(320)],
};

/**
 * Anything else goes in a `ToolbarItem`: given `overflow`, it has a form in
 * the ⋯ menu; without one it stays on the bar. A `flex` item takes the room
 * left, down to its `minWidth`.
 */
export const CustomItems: Story = {
  args: {
    "aria-label": "Editor",
    children: (
      <>
        <ToolbarButton aria-label="Bold">
          <BoldIcon />
        </ToolbarButton>
        <ToolbarItem
          flex
          minWidth={80}
          className="truncate px-2 text-muted-foreground text-ui-sm"
        >
          Saved 2 minutes ago
        </ToolbarItem>
        <ToolbarItem
          overflow={
            <DropdownMenuItem>
              Shortcuts
              <Kbd className="ms-auto">?</Kbd>
            </DropdownMenuItem>
          }
          className="gap-1 px-1 text-ui-sm"
        >
          Shortcuts <Kbd>?</Kbd>
        </ToolbarItem>
      </>
    ),
  },
  decorators: [withResizable(420)],
};

/** At 320px: every part that may move is in the ⋯ menu, and nothing is cut in half. */
export const Narrow: Story = {
  ...SearchAndFilters,
  tags: ["edge", "!autodocs"],
  decorators: [withResizable(320)],
};

/**
 * Pinned parts with no form in the menu that do not fit even alone: the bar
 * scrolls rather than cut them off, and warns in development.
 */
export const PinnedTooWide: Story = {
  args: {
    "aria-label": "Pinned",
    children: (
      <>
        <ToolbarItem className="px-2">A long title that stays</ToolbarItem>
        <ToolbarItem className="px-2">Another that stays too</ToolbarItem>
        <ToolbarButton aria-label="Archive">
          <ArchiveIcon />
        </ToolbarButton>
      </>
    ),
  },
  tags: ["edge", "!autodocs"],
  decorators: [withResizable(240)],
};
