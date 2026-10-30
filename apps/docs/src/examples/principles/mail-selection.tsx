import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { Checkbox } from "@orz/ui/components/checkbox";
import { Label } from "@orz/ui/components/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { ArchiveIcon, MailOpenIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

const INBOX = INBOX_THREADS.filter((thread) => !thread.folder).slice(0, 3);

const ACTIONS = [
  { label: "Archive", Icon: ArchiveIcon },
  { label: "Delete", Icon: Trash2Icon },
  { label: "Mark as read", Icon: MailOpenIcon },
];

export function MailSelection() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    new Set(INBOX.slice(0, 2).map((thread) => thread.id)),
  );
  const select = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };
  return (
    <TooltipProvider>
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center gap-0.5 border-b px-1.5 py-1 text-ui">
          <span className="px-2 tabular-nums">{selected.size} selected</span>
          {ACTIONS.map(({ label, Icon }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={label}>
                  <Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <ul aria-label="Conversations">
          {INBOX.map((thread) => (
            <li
              key={thread.id}
              className="flex items-center gap-3 px-3 py-2 touch:py-3"
            >
              <Checkbox
                id={`selection-${thread.id}`}
                checked={selected.has(thread.id)}
                onCheckedChange={(on) => select(thread.id, on === true)}
              />
              <Label
                htmlFor={`selection-${thread.id}`}
                className="block min-w-0 flex-1 truncate font-normal"
              >
                {thread.subject}
              </Label>
            </li>
          ))}
        </ul>
      </div>
    </TooltipProvider>
  );
}
