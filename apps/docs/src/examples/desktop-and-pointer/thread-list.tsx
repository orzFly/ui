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
import { EmptyState } from "@orz/ui/components/empty-state";
import { Kbd } from "@orz/ui/components/kbd";
import { List, ListItem } from "@orz/ui/components/list";
import { Pane } from "@orz/ui/components/pane";
import { ToolbarButton } from "@orz/ui/components/toolbar";
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
      <Pane purpose="panel" frame="card" className="overflow-hidden">
        <Pane
          purpose="toolbar"
          edge="bottom"
          className="flex items-center gap-1 px-3 py-1.5"
        >
          <span className="flex-1 font-medium text-ui">Inbox</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <ToolbarButton
                size="icon-sm"
                aria-label="Refresh"
                onClick={() => toast("Inbox up to date")}
              >
                <RefreshCwIcon />
              </ToolbarButton>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <ToolbarButton
                size="sm"
                onClick={() => toast("New message started")}
              >
                <SquarePenIcon />
                Compose
              </ToolbarButton>
            </TooltipTrigger>
            <TooltipContent>
              Compose <Kbd>C</Kbd>
            </TooltipContent>
          </Tooltip>
        </Pane>
        <List purpose="collection">
          {threads.length > 0 ? (
            <ul>
              {threads.map((thread) => (
                <ListItem key={thread.id} asChild>
                  <li className="flex min-h-row items-center gap-2 px-3 text-ui touch:min-h-11">
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
                          onSelect={() =>
                            remove(thread, "Conversation archived")
                          }
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
                          onSelect={() =>
                            toast("Conversation marked as unread")
                          }
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
                </ListItem>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing in Inbox" className="py-6" />
          )}
        </List>
      </Pane>
    </TooltipProvider>
  );
}
