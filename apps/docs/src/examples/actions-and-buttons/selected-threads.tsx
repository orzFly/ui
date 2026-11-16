import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Checkbox } from "@orz/ui/components/checkbox";
import { List, ListItem } from "@orz/ui/components/list";
import { SelectionBar } from "@orz/ui/components/selection-bar";
import { ToolbarButton } from "@orz/ui/components/toolbar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { ArchiveIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const threads = INBOX_THREADS.filter(({ folder }) => folder === "inbox").slice(
  0,
  4,
);

export function SelectedThreads() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    new Set([threads[1]?.id ?? ""]),
  );
  const act = (verb: string) => {
    toast(
      `${selected.size} ${selected.size === 1 ? "conversation" : "conversations"} ${verb}`,
    );
    setSelected(new Set());
  };
  return (
    <TooltipProvider>
      <div className="border">
        <SelectionBar
          edge="bottom"
          count={selected.size}
          total={threads.length}
          onSelectAll={() => setSelected(new Set(threads.map(({ id }) => id)))}
          onClear={() => setSelected(new Set())}
          idle={<span className="px-1 font-medium">Inbox</span>}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <ToolbarButton
                aria-label="Archive"
                onClick={() => act("archived")}
              >
                <ArchiveIcon />
              </ToolbarButton>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <ToolbarButton aria-label="Delete" onClick={() => act("deleted")}>
                <Trash2Icon />
              </ToolbarButton>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
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
                  <span className="truncate">{thread.subject}</span>
                </li>
              </ListItem>
            ))}
          </ul>
        </List>
      </div>
    </TooltipProvider>
  );
}
