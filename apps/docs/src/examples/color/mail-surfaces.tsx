import { INBOX_PEOPLE, INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  EllipsisIcon,
  FileTextIcon,
  ForwardIcon,
  InboxIcon,
  LinkIcon,
  SendIcon,
  SquarePenIcon,
  StarIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const FOLDERS = [
  { title: "Inbox", Icon: InboxIcon, count: 3 },
  { title: "Starred", Icon: StarIcon },
  { title: "Sent", Icon: SendIcon },
  { title: "Drafts", Icon: FileTextIcon, count: 1 },
];

const ROWS = [
  { id: "touch-sizes", day: "Oct 27" },
  { id: "contrast-audit", day: "Oct 27" },
  { id: "flaky-retry", day: "Oct 27" },
].flatMap(({ id, day }) => {
  const thread = INBOX_THREADS.find((each) => each.id === id);
  const last = thread?.messages.at(-1);
  return thread && last ? [{ thread, last, day }] : [];
});

export function MailSurfaces() {
  const [folder, setFolder] = useState("Inbox");
  const [open, setOpen] = useState("touch-sizes");
  return (
    <TooltipProvider>
      <div className="grid overflow-hidden rounded-xl border bg-background text-foreground sm:grid-cols-[10rem_1fr]">
        <nav
          aria-label="Folders"
          className="grid content-start gap-3 border-r bg-sidebar p-2 text-sidebar-foreground max-sm:hidden"
        >
          <Button size="sm" className="justify-start">
            <SquarePenIcon />
            Compose
          </Button>
          <ul className="grid gap-0.5">
            {FOLDERS.map(({ title, Icon, count }) => (
              <li key={title}>
                <button
                  type="button"
                  aria-current={title === folder ? "page" : undefined}
                  onClick={() => setFolder(title)}
                  className={cn(
                    "flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                    title === folder &&
                      "bg-accent font-medium text-accent-foreground",
                  )}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="flex-1 text-left">{title}</span>
                  {count && (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {count}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <div className="flex h-11 items-center gap-2 border-b px-3">
            <span className="font-medium text-sm">{folder}</span>
          </div>
          <ul aria-label="Conversations" className="divide-y">
            {ROWS.map(({ thread, last, day }) => (
              <li
                key={thread.id}
                className={cn(
                  "flex items-start transition-colors hover:bg-accent hover:text-accent-foreground",
                  thread.id === open && "bg-accent text-accent-foreground",
                )}
              >
                <button
                  type="button"
                  aria-current={thread.id === open ? "true" : undefined}
                  onClick={() => setOpen(thread.id)}
                  className="grid min-w-0 flex-1 grid-cols-[1fr_auto] gap-x-2 px-3 py-2.5 text-left"
                >
                  <span className="truncate font-medium text-sm">
                    {INBOX_PEOPLE[last.from] ?? last.from}
                  </span>
                  <time
                    dateTime={last.at}
                    className="text-muted-foreground text-xs"
                  >
                    {day}
                  </time>
                  <span className="col-span-2 truncate text-sm">
                    {thread.subject}
                  </span>
                  <span className="col-span-2 truncate text-muted-foreground text-xs">
                    {last.body.split("`").map((part, index) =>
                      index % 2 === 1 ? (
                        <code
                          key={part}
                          className="rounded bg-muted px-1 font-mono text-foreground"
                        >
                          {part}
                        </code>
                      ) : (
                        part
                      ),
                    )}
                  </span>
                </button>
                {thread.id === open && (
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="mt-2 mr-2"
                            aria-label={`More actions for “${thread.subject}”`}
                          >
                            <EllipsisIcon />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>More actions</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem>
                        <ForwardIcon />
                        Forward
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => toast("Link copied")}>
                        <LinkIcon />
                        Copy link
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </TooltipProvider>
  );
}
