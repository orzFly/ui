import { INBOX_PEOPLE, INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { Checkbox } from "@orz/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import {
  ArchiveIcon,
  EllipsisIcon,
  MailIcon,
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

export function MailList() {
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
    <div className="grid gap-3">
      <ul className="divide-y rounded-xl border bg-card text-card-foreground">
        {threads.map((thread) => (
          <li key={thread.id} className="flex items-center gap-3 px-3 py-2">
            <Checkbox aria-label={`Select “${thread.subject}”`} />
            <div className="grid min-w-0 flex-1 text-ui">
              <span className="truncate font-medium">{thread.from}</span>
              <span className="truncate text-muted-foreground">
                {thread.subject}
              </span>
            </div>
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
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onSelect={() => remove(thread, "Conversation archived")}
                >
                  <ArchiveIcon />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => remove(thread, "Conversation moved to Trash")}
                >
                  <Trash2Icon />
                  Delete
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => toast("Conversation marked as unread")}
                >
                  <MailIcon />
                  Mark as unread
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
        {threads.length === 0 && (
          <li className="py-6 text-center text-muted-foreground text-ui">
            Nothing in Inbox
          </li>
        )}
      </ul>
      <Button size="lg" className="justify-self-end">
        <SquarePenIcon />
        Compose
      </Button>
    </div>
  );
}
