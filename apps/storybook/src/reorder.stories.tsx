import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import { List, ListItem, ListLabel } from "@orz/ui/components/list";
import {
  moveInGroups,
  moveItem,
  Reorder,
  ReorderButtons,
  ReorderGroup,
  ReorderHandle,
  ReorderItem,
} from "@orz/ui/components/reorder";
import {
  Table as DataTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@orz/ui/components/table";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { EllipsisIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { withScroller } from "./decorators.tsx";

/** Where a notification goes, tried in the order the reader set. */
const CHANNELS: Record<string, { name: string; detail: string }> = {
  push: { name: "Push to phone", detail: "2 devices" },
  email: { name: "Email", detail: "alice@example.com" },
  chat: { name: "Chat webhook", detail: "hooks.example" },
  sms: { name: "SMS", detail: "+1 555 0100" },
  desktop: { name: "Desktop notification", detail: "This browser" },
};
const CHANNEL_IDS = Object.keys(CHANNELS);

/** Routes matched top to bottom; the catch-all stays last. */
const ROUTES: Record<string, { upstream: string; rule: string }> = {
  "/api/*": { upstream: "api-pool", rule: "Rate limit 100/min" },
  "/static/*": { upstream: "cdn", rule: "Cache 1 day" },
  "/admin/*": { upstream: "admin", rule: "Sign-in required" },
  "/docs/*": { upstream: "docs.example", rule: "Redirect" },
  "/*": { upstream: "web", rule: "Everything else" },
};
const CATCH_ALL = "/*";

const TIERS = [
  { id: "first", name: "Notify first", items: ["push", "email"] },
  {
    id: "fallback",
    name: "If nobody answers",
    items: ["chat", "sms", "desktop"],
  },
  { id: "paused", name: "Paused", items: [] as string[] },
];
const tierName = (id: string) => TIERS.find((t) => t.id === id)?.name ?? id;

const OWNERS = [
  { id: "work", name: "Work", items: ["email", "chat"] },
  { id: "personal", name: "Personal", items: ["push", "sms", "desktop"] },
];

const MANY = Array.from({ length: 200 }, (_, i) => `rule-${i + 1}`);
const LONG = Array.from({ length: 40 }, (_, i) => `channel-${i + 1}`);

/** A channel's row: its grip, its name and address, its pair and its own menu. */
const channelRow = (id: string) => {
  const { name, detail } = CHANNELS[id] ?? { name: id, detail: "" };
  return (
    <ListItem key={id} asChild>
      <ReorderItem id={id} name={name} asChild>
        <li className="flex min-h-row items-center gap-2 pr-1 touch:pr-hit-xs">
          <ReorderHandle />
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="truncate">{name}</span>
            <span className="truncate text-ui-sm text-muted-foreground">
              {detail}
            </span>
          </span>
          <ReorderButtons />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`More actions for ${name}`}
              >
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Edit…</DropdownMenuItem>
              <DropdownMenuItem variant="destructive">Remove</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ReorderItem>
    </ListItem>
  );
};

/** A list of things the reader keeps, framed in the flow of a page. */
const withList: Decorator = (Story) => (
  <List purpose="collection" framed className="max-w-lg">
    <Story />
  </List>
);

const withRoutesTable: Decorator = (Story) => (
  <DataTable className="max-w-2xl">
    <TableHeader>
      <TableRow>
        <TableHead className="w-0 p-0" />
        <TableHead>Match</TableHead>
        <TableHead>Upstream</TableHead>
        <TableHead>Rule</TableHead>
        <TableHead className="w-0">
          <span className="sr-only">Order</span>
        </TableHead>
      </TableRow>
    </TableHeader>
    <Story />
  </DataTable>
);

const meta = {
  title: "ui/Reorder",
  component: Reorder,
  parameters: { guidelines: "/guidelines/patterns/reordering/" },
  args: { items: CHANNEL_IDS, onMove: () => {}, disabled: false },
  argTypes: { onMove: { control: false } },
  decorators: [withList],
  render: function Render(args) {
    // Held here rather than written back to the args: the slide needs the
    // new order in the same frame, and an args update comes later.
    const [items, setItems] = useState(args.items ?? []);
    useEffect(() => setItems(args.items ?? []), [args.items]);
    return (
      <Reorder
        items={items}
        disabled={args.disabled}
        onMove={(move) => setItems((xs) => moveItem(xs, move))}
        asChild
      >
        <ul>{items.map(channelRow)}</ul>
      </Reorder>
    );
  },
} satisfies Meta<typeof Reorder>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Notification channels, tried in the order shown: drag a row by its grip, or press its ↑ and
 * ↓, or Alt+↑ and Alt+↓ (⌥ on a Mac) from anywhere in the row.
 */
export const Playground: Story = {};

const TABLE_CODE = `<Reorder
  items={routes}
  onMove={(move) => setRoutes((rs) => moveItem(rs, move))}
  // The catch-all stays last: it never moves, and nothing goes below it.
  canMove={(id) => id !== "/*"}
  canDrop={(id, to) => to.index < routes.length - 1}
  asChild
>
  <TableBody>
    {routes.map((match) => (
      <ReorderItem key={match} id={match} name={match} asChild>
        <TableRow>
          <TableCell className="w-0 p-0"><ReorderHandle /></TableCell>
          <TableCell className="font-mono">{match}</TableCell>
          …
          <TableCell className="w-0"><ReorderButtons /></TableCell>
        </TableRow>
      </ReorderItem>
    ))}
  </TableBody>
</Reorder>`;

/**
 * Table rows, the grip in a first cell and the pair in the last. The catch-all route never moves
 * (`canMove`), and `canDrop` keeps every other route above it.
 */
export const Table: Story = {
  args: { items: Object.keys(ROUTES) },
  decorators: [withRoutesTable],
  parameters: { docs: { source: { code: TABLE_CODE } } },
  render: function Render(args) {
    const [items, setItems] = useState(args.items ?? []);
    useEffect(() => setItems(args.items ?? []), [args.items]);
    return (
      <Reorder
        items={items}
        disabled={args.disabled}
        onMove={(move) => setItems((xs) => moveItem(xs, move))}
        canMove={(id) => id !== CATCH_ALL}
        canDrop={(_, to) => to.index < items.length - 1}
        asChild
      >
        <TableBody>
          {items.map((match) => (
            <ReorderItem key={match} id={match} name={match} asChild>
              <TableRow>
                <TableCell className="w-0 p-0">
                  <ReorderHandle />
                </TableCell>
                <TableCell className="font-mono">{match}</TableCell>
                <TableCell className="font-mono">
                  {ROUTES[match]?.upstream}
                </TableCell>
                <TableCell>{ROUTES[match]?.rule}</TableCell>
                <TableCell className="w-0">
                  <ReorderButtons />
                </TableCell>
              </TableRow>
            </ReorderItem>
          ))}
        </TableBody>
      </Reorder>
    );
  },
};

const GROUPS_CODE = `<Reorder
  groups={tiers}
  onMove={(move) => setTiers((ts) => moveInGroups(ts, move))}
  // "Notify first" takes at most two channels.
  canDrop={(id, to) =>
    to.group !== "first" || tiers[0].items.filter((i) => i !== id).length < 2
  }
>
  {tiers.map((tier) => (
    <ReorderGroup key={tier.id} id={tier.id} name={tier.name} asChild>
      <section>
        <ListLabel asChild><h3>{tier.name}</h3></ListLabel>
        {tier.items.length === 0 && <p>No channels</p>}
        <ul>{tier.items.map((id) => /* a channel's row, as above */)}</ul>
      </section>
    </ReorderGroup>
  ))}
</Reorder>`;

/**
 * Rows under headings, moving between them: a drag carries a row past a heading, and a button at
 * a group's end steps into the next. "Notify first" takes at most two channels, so while it is
 * full a drag into it holds the gap at the nearest place that takes the row, and ↑ skips it.
 */
export const Groups: Story = {
  args: { items: undefined, groups: TIERS },
  parameters: { docs: { source: { code: GROUPS_CODE } } },
  render: function Render(args) {
    const [groups, setGroups] = useState(args.groups ?? []);
    useEffect(() => setGroups(args.groups ?? []), [args.groups]);
    return (
      <Reorder
        groups={groups}
        disabled={args.disabled}
        onMove={(move) => setGroups((gs) => moveInGroups(gs, move))}
        canDrop={(id, to) =>
          to.group !== "first" ||
          (groups[0]?.items.filter((i) => i !== id).length ?? 0) < 2
        }
      >
        {groups.map((tier) => (
          <ReorderGroup
            key={tier.id}
            id={tier.id}
            name={tierName(tier.id)}
            asChild
          >
            <section>
              <ListLabel asChild>
                <h3 className="px-2.5 pt-2 pb-1">{tierName(tier.id)}</h3>
              </ListLabel>
              {tier.items.length === 0 && (
                <p className="px-2.5 pb-2 text-ui-sm text-muted-foreground">
                  No channels
                </p>
              )}
              <ul>{tier.items.map(channelRow)}</ul>
            </section>
          </ReorderGroup>
        ))}
      </Reorder>
    );
  },
};

/**
 * Rows grouped by something they are, not by their order: each group is its own `Reorder`, and a
 * row moves only within it. Moving a channel to another owner is an edit of the channel.
 */
export const SeparateGroups: Story = {
  args: { items: undefined, groups: OWNERS },
  render: function Render(args) {
    const [groups, setGroups] = useState(args.groups ?? []);
    useEffect(() => setGroups(args.groups ?? []), [args.groups]);
    return (
      <div>
        {groups.map((owner) => (
          <section key={owner.id}>
            <ListLabel asChild>
              <h3 className="px-2.5 pt-2 pb-1">
                {OWNERS.find((o) => o.id === owner.id)?.name}
              </h3>
            </ListLabel>
            <Reorder
              items={owner.items}
              onMove={(move) =>
                setGroups((gs) =>
                  gs.map((g) =>
                    g.id === owner.id
                      ? { ...g, items: moveItem(g.items, move) }
                      : g,
                  ),
                )
              }
              disabled={args.disabled}
              asChild
            >
              <ul>{owner.items.map(channelRow)}</ul>
            </Reorder>
          </section>
        ))}
      </div>
    );
  },
};

/** While the order is being saved, say: the grips fade and the buttons disable. */
export const Disabled: Story = {
  args: { disabled: true },
};

/** Forty rows in a scroller: hold a row near its edge and the list scrolls under it. */
export const LongList: Story = {
  tags: ["edge", "!autodocs"],
  args: { items: LONG },
  decorators: [withScroller(240)],
};

/** Rows of different heights: the place follows each row's own middle. */
export const MixedHeights: Story = {
  tags: ["edge", "!autodocs"],
  render: function Render(args) {
    const [items, setItems] = useState(args.items ?? []);
    useEffect(() => setItems(args.items ?? []), [args.items]);
    return (
      <Reorder
        items={items}
        disabled={args.disabled}
        onMove={(move) => setItems((xs) => moveItem(xs, move))}
        asChild
      >
        <ul>
          {items.map((id, i) => {
            const { name, detail } = CHANNELS[id] ?? { name: id, detail: "" };
            return (
              <ListItem key={id} asChild>
                <ReorderItem id={id} name={name} asChild>
                  <li className="flex min-h-row items-center gap-2 py-1 pr-1 touch:pr-hit-xs">
                    <ReorderHandle />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span>{name}</span>
                      {i % 2 === 1 && (
                        <span className="text-ui-sm text-muted-foreground">
                          {detail}, tried once a minute until someone answers
                        </span>
                      )}
                    </span>
                    <ReorderButtons />
                  </li>
                </ReorderItem>
              </ListItem>
            );
          })}
        </ul>
      </Reorder>
    );
  },
};

/** A list of one row: nothing to drag, both buttons disabled. */
export const SingleRow: Story = {
  tags: ["edge", "!autodocs"],
  args: { items: ["email"] },
};

/**
 * Two hundred rows whose last place takes none: `canMoveUp` and `canMoveDown` answer for the
 * buttons at once, so no render walks the places with `canDrop`.
 */
export const ManyRules: Story = {
  tags: ["edge", "!autodocs"],
  args: { items: MANY },
  decorators: [withScroller(320)],
  render: function Render(args) {
    const [items, setItems] = useState(args.items ?? []);
    useEffect(() => setItems(args.items ?? []), [args.items]);
    const last = items.length - 1;
    return (
      <Reorder
        items={items}
        disabled={args.disabled}
        onMove={(move) => setItems((xs) => moveItem(xs, move))}
        canDrop={(_, to) => to.index < last}
        canMoveUp={(id) => items.indexOf(id) > 0}
        canMoveDown={(id) => items.indexOf(id) < last - 1}
        asChild
      >
        <ul>
          {items.map((id) => (
            <ListItem key={id} asChild>
              <ReorderItem id={id} name={id} asChild>
                <li className="flex min-h-row items-center gap-2 pr-1 touch:pr-hit-xs">
                  <ReorderHandle />
                  <span className="min-w-0 flex-1 truncate">{id}</span>
                  <ReorderButtons />
                </li>
              </ReorderItem>
            </ListItem>
          ))}
        </ul>
      </Reorder>
    );
  },
};
