import {
  INBOX_LABELS,
  INBOX_THREADS,
  type InboxThread,
} from "@orz/fixtures/inbox.ts";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import {
  ArchiveIcon,
  InboxIcon,
  MailIcon,
  StarIcon,
  TagIcon,
} from "lucide-react";
import { type ComponentProps, useState } from "react";
import { toast } from "sonner";

const thread = INBOX_THREADS.find(
  ({ id }) => id === "touch-sizes",
) as InboxThread;

function IconButton({
  label,
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} {...props} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ThreadToolbar() {
  const [archived, setArchived] = useState(false);
  const [labels, setLabels] = useState(thread.labels);
  const [starred, setStarred] = useState(thread.starred);
  const move = (archive: boolean) => {
    setArchived(archive);
    toast(archive ? "Conversation archived" : "Conversation moved to Inbox", {
      action: { label: "Undo", onClick: () => setArchived(!archive) },
    });
  };
  return (
    <TooltipProvider>
      <div className="grid gap-3">
        <div className="flex items-center gap-0.5">
          <IconButton
            label={archived ? "Move to Inbox" : "Archive"}
            onClick={() => move(!archived)}
          >
            {archived ? <InboxIcon /> : <ArchiveIcon />}
          </IconButton>
          <IconButton
            label="Mark as unread"
            onClick={() => toast("Conversation marked as unread")}
          >
            <MailIcon />
          </IconButton>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Labels">
                    <TagIcon />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Labels</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuLabel>Labels</DropdownMenuLabel>
              {INBOX_LABELS.map((label) => (
                <DropdownMenuCheckboxItem
                  key={label}
                  checked={labels.includes(label)}
                  onCheckedChange={(on) =>
                    setLabels((now) =>
                      on ? [...now, label] : now.filter((x) => x !== label),
                    )
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <IconButton
            label="Star"
            aria-pressed={starred}
            className="ml-auto"
            onClick={() => setStarred(!starred)}
          >
            <StarIcon className={starred ? "fill-current" : undefined} />
          </IconButton>
        </div>
        <h3 className="font-medium">{thread.subject}</h3>
        <p className="flex flex-wrap gap-1">
          {archived && <Badge>Archive</Badge>}
          {labels.map((label) => (
            <Badge key={label} variant="outline">
              {label}
            </Badge>
          ))}
        </p>
      </div>
    </TooltipProvider>
  );
}
