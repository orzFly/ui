import {
  INBOX_PEOPLE,
  INBOX_THREADS,
  type InboxThread,
} from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { cn } from "@orz/ui/lib/utils";
import {
  ArchiveIcon,
  EllipsisIcon,
  MailIcon,
  MailOpenIcon,
  SquarePenIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const INBOX = INBOX_THREADS.filter((thread) => !thread.folder).slice(0, 4);

const senders = (thread: InboxThread) =>
  [...new Set(thread.messages.map((message) => message.from))]
    .map((login) => INBOX_PEOPLE[login] ?? login)
    .join(", ");

export function ThreadRows() {
  const [threads, setThreads] = useState(INBOX);
  const change = (next: InboxThread[], message: string) => {
    const before = threads;
    setThreads(next);
    toast(message, {
      action: { label: "Undo", onClick: () => setThreads(before) },
    });
  };
  const remove = (id: string, message: string) =>
    change(
      threads.filter((thread) => thread.id !== id),
      message,
    );
  return (
    <TooltipProvider>
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-sm">Inbox</h3>
          <Button>
            <SquarePenIcon data-icon="inline-start" /> Compose
          </Button>
        </div>
        <ul aria-label="Conversations" className="grid">
          {threads.map((thread) => (
            <li
              key={thread.id}
              className="flex min-h-9 items-center gap-2 rounded-md px-2 py-1 hover:bg-accent/60 touch:min-h-11"
            >
              <div className="grid min-w-0 flex-1">
                <span
                  className={cn(
                    "truncate text-sm",
                    thread.unread && "font-semibold",
                  )}
                >
                  {thread.unread && <span className="sr-only">Unread: </span>}
                  {thread.subject}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {senders(thread)}
                </span>
              </div>
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`More actions for “${thread.subject}”`}
                      >
                        <EllipsisIcon />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>More actions</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onSelect={() => remove(thread.id, "Conversation archived")}
                  >
                    <ArchiveIcon /> Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      change(
                        threads.map((each) =>
                          each.id === thread.id
                            ? { ...each, unread: !each.unread }
                            : each,
                        ),
                        `Conversation marked as ${thread.unread ? "read" : "unread"}`,
                      )
                    }
                  >
                    {thread.unread ? <MailOpenIcon /> : <MailIcon />}
                    {thread.unread ? "Mark as read" : "Mark as unread"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() =>
                      remove(thread.id, "Conversation moved to Trash")
                    }
                  >
                    <Trash2Icon /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      </div>
    </TooltipProvider>
  );
}
