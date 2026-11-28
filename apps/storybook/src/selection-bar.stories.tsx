import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@orz/ui/components/dropdown-menu";
import {
  FilterMenu,
  MatchedText,
  matchText,
} from "@orz/ui/components/filter-menu";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@orz/ui/components/segmented-control";
import { SelectionBar } from "@orz/ui/components/selection-bar";
import {
  ToolbarButton,
  ToolbarItem,
  ToolbarLabel,
  ToolbarMenu,
  ToolbarOverflow,
  ToolbarSearch,
  ToolbarSeparator,
  ToolbarSpacer,
} from "@orz/ui/components/toolbar";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ArchiveIcon,
  CircleDotIcon,
  DownloadIcon,
  InboxIcon,
  MailOpenIcon,
  PlusIcon,
  RefreshCwIcon,
  SettingsIcon,
  StarIcon,
  TagIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react";
import { useState } from "react";
import { fn } from "storybook/test";
import { argsUpdater } from "./args.ts";
import { withResizable, withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/SelectionBar",
  component: SelectionBar,
  parameters: { guidelines: "/guidelines/patterns/actions-and-buttons/" },
  args: {
    "aria-label": "Inbox",
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
        <ToolbarItem flex minWidth={80}>
          <span className="truncate px-1 font-medium">Inbox</span>
        </ToolbarItem>
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

export const Playground: Story = { decorators: [withWidth("w-96")] };

/** Nothing selected: the checkbox, then the list's own toolbar. */
export const Idle: Story = {
  args: { count: 0 },
  decorators: [withWidth("w-96")],
};

/** Every row selected, with a text action of the app's after its icons. */
export const AllSelected: Story = {
  args: {
    count: 25,
    children: (
      <>
        <ToolbarButton aria-label="Move to Inbox">
          <InboxIcon />
        </ToolbarButton>
        <ToolbarButton variant="destructive">Delete forever…</ToolbarButton>
      </>
    ),
  },
  decorators: [withWidth("w-96")],
};

const LABELS = ["bug", "design", "docs", "ui"];
const PEOPLE = ["alice", "bot-one", "newcomer"];

/**
 * A list's whole toolbar while nothing is selected, and the actions on the
 * selection once something is. Drag the frame's corner narrower: both give
 * up their words, then go into the ⋯, while the checkbox, the count and
 * Clear stay. Set status uses the selection up, as rows that leave the list
 * would, and the focus goes to the checkbox.
 */
export const ListToolbar: Story = {
  args: { "aria-label": "Issues", count: 0 },
  decorators: [withResizable(760)],
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    const [view, setView] = useState("list");
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("open");
    const [labels, setLabels] = useState<string[]>([]);
    const [labelQuery, setLabelQuery] = useState("");
    const [starred, setStarred] = useState(false);
    const [given, setGiven] = useState<string[]>([]);
    const [givenQuery, setGivenQuery] = useState("");
    const [assigned, setAssigned] = useState<string[]>([]);
    const [assignedQuery, setAssignedQuery] = useState("");
    const toggle =
      (set: (update: (ids: string[]) => string[]) => void) =>
      (row: { id: string }, event: { selected: boolean }) =>
        set((ids) =>
          event.selected ? [...ids, row.id] : ids.filter((id) => id !== row.id),
        );
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
        idle={
          <>
            <SegmentedControl
              aria-label="View"
              value={view}
              onValueChange={setView}
              toolbarActive={view !== "list"}
            >
              <SegmentedControlItem value="list">List</SegmentedControlItem>
              <SegmentedControlItem value="board">Board</SegmentedControlItem>
            </SegmentedControl>
            <ToolbarSeparator />
            <ToolbarSearch
              label="Search issues"
              placeholder="Search…"
              minWidth={140}
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
                <DropdownMenuRadioItem value="closed">
                  Closed
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </ToolbarMenu>
            <FilterMenu
              selection="multiple"
              selectedIds={labels}
              query={labelQuery}
              onQueryChange={setLabelQuery}
              sections={[
                {
                  id: "labels",
                  rows: LABELS.filter((id) => matchText(id, labelQuery)).map(
                    (id) => ({ id }),
                  ),
                },
              ]}
              renderRow={(row, state) => (
                <MatchedText text={row.id} query={state.query} />
              )}
              onSelect={toggle(setLabels)}
              listLabel="Labels"
              toolbarActive={labels.length > 0}
            >
              <ToolbarButton>
                <TagIcon />
                <ToolbarLabel>Labels</ToolbarLabel>
              </ToolbarButton>
            </FilterMenu>
            <ToolbarButton
              aria-label="Starred only"
              aria-pressed={starred}
              onClick={() => setStarred(!starred)}
            >
              <StarIcon />
            </ToolbarButton>
            <ToolbarSpacer />
            <ToolbarButton variant="default" priority="pin">
              <PlusIcon />
              <ToolbarLabel>New issue</ToolbarLabel>
            </ToolbarButton>
            <ToolbarOverflow>
              <DropdownMenuItem>
                <DownloadIcon />
                Export…
              </DropdownMenuItem>
              <DropdownMenuItem>
                <SettingsIcon />
                List settings
              </DropdownMenuItem>
            </ToolbarOverflow>
          </>
        }
      >
        <ToolbarMenu icon={<CircleDotIcon />} label="Set status">
          <DropdownMenuItem onSelect={() => updateArgs({ count: 0 })}>
            Close
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => updateArgs({ count: 0 })}>
            Close as not planned
          </DropdownMenuItem>
        </ToolbarMenu>
        <FilterMenu
          selection="multiple"
          selectedIds={given}
          query={givenQuery}
          onQueryChange={setGivenQuery}
          sections={[
            {
              id: "labels",
              rows: LABELS.filter((id) => matchText(id, givenQuery)).map(
                (id) => ({ id }),
              ),
            },
          ]}
          renderRow={(row, state) => (
            <MatchedText text={row.id} query={state.query} />
          )}
          onSelect={toggle(setGiven)}
          listLabel="Labels"
        >
          <ToolbarButton>
            <TagIcon />
            <ToolbarLabel>Labels</ToolbarLabel>
          </ToolbarButton>
        </FilterMenu>
        <FilterMenu
          selection="multiple"
          selectedIds={assigned}
          query={assignedQuery}
          onQueryChange={setAssignedQuery}
          sections={[
            {
              id: "people",
              rows: PEOPLE.filter((id) => matchText(id, assignedQuery)).map(
                (id) => ({ id }),
              ),
            },
          ]}
          renderRow={(row, state) => (
            <MatchedText text={row.id} query={state.query} />
          )}
          onSelect={toggle(setAssigned)}
          listLabel="Assignees"
        >
          <ToolbarButton>
            <UserIcon />
            <ToolbarLabel>Assignees</ToolbarLabel>
          </ToolbarButton>
        </FilterMenu>
        <ToolbarButton>
          <MailOpenIcon />
          <ToolbarLabel>Mark as read</ToolbarLabel>
        </ToolbarButton>
      </SelectionBar>
    );
  },
};

/**
 * The bar idle over the bar selecting, each holding ListToolbar's parts: one
 * height in either state, under every style and pointer.
 */
export const OneHeight: Story = {
  args: { "aria-label": "Issues" },
  tags: ["edge", "!autodocs"],
  decorators: [withResizable(760)],
  render: function Render(args, context) {
    // Called as ListToolbar's story is, each with hooks of its own.
    const idle = ListToolbar.render?.({ ...args, count: 0 }, context);
    const selecting = ListToolbar.render?.({ ...args, count: 2 }, context);
    return (
      <div className="grid gap-4">
        {idle}
        {selecting}
      </div>
    );
  },
};
