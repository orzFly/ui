import { INBOX_PEOPLE, INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
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
  EllipsisIcon,
  LinkIcon,
  MailIcon,
  RefreshCwIcon,
  SquarePenIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const THREADS = INBOX_THREADS.filter(({ folder }) => folder === undefined)
  .slice(0, 3)
  .map(({ id, subject, messages }) => ({
    id,
    subject,
    from: INBOX_PEOPLE[messages[0]?.from ?? ""],
  }));

type Thread = (typeof THREADS)[number];

export function ThreadList() {
  const [threads, setThreads] = useState(THREADS);
  const remove = (thread: Thread, message: string) => {
    setThreads((now) => now.filter((each) => each !== thread));
    toast(message, {
      action: {
        label: "Undo",
        onClick: () =>
          setThreads((now) =>
            THREADS.filter((each) => each === thread || now.includes(each)),
          ),
      },
    });
  };
  return (
    <TooltipProvider>
      <div className="overflow-hidden rounded-xl border bg-card text-card-foreground">
        <div className="flex items-center gap-1 border-b px-3 py-1.5">
          <span className="flex-1 font-medium text-sm">Inbox</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Refresh"
                onClick={() => toast("Inbox up to date")}
              >
                <RefreshCwIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toast("New message started")}
              >
                <SquarePenIcon />
                Compose
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Compose <kbd className="font-mono">C</kbd>
            </TooltipContent>
          </Tooltip>
        </div>
        <ul className="divide-y">
          {threads.map((thread) => (
            <li
              key={thread.id}
              className="flex min-h-9 items-center gap-2 px-3 text-sm touch:min-h-11"
            >
              <span className="w-20 shrink-0 truncate font-medium">
                {thread.from}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {thread.subject}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`More actions for “${thread.subject}”`}
                  >
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    onSelect={() => remove(thread, "Conversation archived")}
                  >
                    <ArchiveIcon />
                    Archive
                    <DropdownMenuShortcut>E</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      remove(thread, "Conversation moved to Trash")
                    }
                  >
                    <Trash2Icon />
                    Delete
                    <DropdownMenuShortcut>#</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => toast("Conversation marked as unread")}
                  >
                    <MailIcon />
                    Mark as unread
                    <DropdownMenuShortcut>Shift U</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => toast("Link copied")}>
                    <LinkIcon />
                    Copy link
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
        {threads.length === 0 && (
          <p className="py-6 text-center text-muted-foreground text-sm">
            Nothing in Inbox
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}
