import {
  INBOX_LABEL_COLORS,
  INBOX_THREADS,
  type InboxThread,
} from "@orz/fixtures/inbox.ts";
import { Badge } from "@orz/ui/components/badge";
import { Checkbox } from "@orz/ui/components/checkbox";
import {
  FilterMenu,
  MatchedText,
  matchText,
} from "@orz/ui/components/filter-menu";
import { List, ListItem } from "@orz/ui/components/list";
import { Pane } from "@orz/ui/components/pane";
import { SelectionBar } from "@orz/ui/components/selection-bar";
import {
  ToolbarButton,
  ToolbarItem,
  ToolbarLabel,
} from "@orz/ui/components/toolbar";
import { cn } from "@orz/ui/lib/utils";
import {
  ArchiveIcon,
  MailIcon,
  MailOpenIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const THREADS = INBOX_THREADS.filter(({ folder }) => folder === "inbox").slice(
  0,
  4,
);
const LABELS = [...new Set(THREADS.flatMap((thread) => thread.labels))];

// The frame's corner drags it narrower: the actions give up their words,
// then go into the ⋯, as the bar's own width asks.
export function SelectedThreads() {
  const [threads, setThreads] = useState(THREADS);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    new Set([THREADS[1]?.id ?? ""]),
  );
  const [query, setQuery] = useState("");
  // The threads as the menu opened, which a label partly picked goes back to.
  const [opened, setOpened] = useState(threads);
  const chosen = threads.filter(({ id }) => selected.has(id));
  const anyUnread = chosen.some((thread) => thread.unread);
  const count = (label: string) =>
    chosen.filter((thread) => thread.labels.includes(label)).length;
  const act = (verb: string) => {
    toast(
      `${selected.size} ${selected.size === 1 ? "conversation" : "conversations"} ${verb}`,
    );
    setSelected(new Set());
  };
  const change = (each: (thread: InboxThread) => Partial<InboxThread>) =>
    setThreads((all) =>
      all.map((thread) =>
        selected.has(thread.id) ? { ...thread, ...each(thread) } : thread,
      ),
    );
  return (
    <Pane
      purpose="panel"
      frame="inset"
      className="w-xl min-w-48 max-w-full resize-x overflow-hidden"
    >
      <SelectionBar
        aria-label="Inbox"
        edge="bottom"
        count={selected.size}
        total={threads.length}
        onSelectAll={() => setSelected(new Set(threads.map(({ id }) => id)))}
        onClear={() => setSelected(new Set())}
        idle={
          <ToolbarItem flex minWidth={80}>
            <span className="truncate px-1 font-medium">Inbox</span>
          </ToolbarItem>
        }
      >
        <ToolbarButton aria-label="Archive" onClick={() => act("archived")}>
          <ArchiveIcon />
        </ToolbarButton>
        <ToolbarButton aria-label="Delete" onClick={() => act("deleted")}>
          <Trash2Icon />
        </ToolbarButton>
        <FilterMenu
          selection="multiple"
          selectedIds={LABELS.filter((label) => count(label) === chosen.length)}
          mixedIds={LABELS.filter(
            (label) => count(label) > 0 && count(label) < chosen.length,
          )}
          onOpenChange={(open) => {
            if (open) setOpened(threads);
          }}
          query={query}
          onQueryChange={setQuery}
          sections={[
            {
              id: "labels",
              rows: LABELS.filter((label) => matchText(label, query)).map(
                (label) => ({ id: label }),
              ),
            },
          ]}
          onSelect={(row, event) =>
            change((thread) => {
              const was = opened.find(({ id }) => id === thread.id);
              const on = event.mixed
                ? (was?.labels.includes(row.id) ?? false)
                : event.selected;
              return {
                labels: LABELS.filter((label) =>
                  label === row.id ? on : thread.labels.includes(label),
                ),
              };
            })
          }
          renderRow={(row, state) => (
            <MatchedText text={row.id} query={state.query} />
          )}
          placeholder="Filter labels…"
          inputLabel="Filter labels"
          listLabel="Labels"
        >
          <ToolbarButton>
            <TagIcon />
            <ToolbarLabel>Labels</ToolbarLabel>
          </ToolbarButton>
        </FilterMenu>
        <ToolbarButton onClick={() => change(() => ({ unread: !anyUnread }))}>
          {anyUnread ? <MailOpenIcon /> : <MailIcon />}
          <ToolbarLabel>
            {anyUnread ? "Mark as read" : "Mark as unread"}
          </ToolbarLabel>
        </ToolbarButton>
      </SelectionBar>
      <List purpose="listbox">
        <ul>
          {threads.map((thread) => (
            <ListItem
              asChild
              key={thread.id}
              selected={selected.has(thread.id)}
            >
              <li className="flex min-h-row items-center gap-3 px-3 py-1.5">
                <Checkbox
                  checked={selected.has(thread.id)}
                  onCheckedChange={(on) => {
                    const next = new Set(selected);
                    if (on === true) next.add(thread.id);
                    else next.delete(thread.id);
                    setSelected(next);
                  }}
                  aria-label={`Select “${thread.subject}”`}
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    thread.unread && "font-semibold",
                  )}
                >
                  {thread.unread && <span className="sr-only">Unread: </span>}
                  {thread.subject}
                </span>
                {thread.labels.map((label) => (
                  <Badge
                    key={label}
                    variant="marker"
                    color={INBOX_LABEL_COLORS[label]}
                  >
                    {label}
                  </Badge>
                ))}
              </li>
            </ListItem>
          ))}
        </ul>
      </List>
    </Pane>
  );
}
