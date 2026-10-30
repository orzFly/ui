import {
  INBOX_PEOPLE,
  INBOX_THREADS,
  type InboxThread,
} from "@orz/fixtures/inbox.ts";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { Markdown } from "@orz/ui-markdown";
import { ArchiveIcon, MailIcon, SendIcon, Trash2Icon } from "lucide-react";

const THREAD = INBOX_THREADS.find(
  (thread) => thread.id === "touch-sizes",
) as InboxThread;
const MESSAGE = THREAD.messages.at(-1);

const ACTIONS = [
  { label: "Archive", Icon: ArchiveIcon },
  { label: "Delete", Icon: Trash2Icon },
  { label: "Mark as unread", Icon: MailIcon },
];

export function QuietThread() {
  return (
    <TooltipProvider>
      <article className="overflow-hidden rounded-lg border">
        <div className="flex gap-0.5 border-b px-2 py-1">
          {ACTIONS.map(({ label, Icon }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={label}>
                  <Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <header className="grid gap-1 px-4 pt-3">
          <h3 className="font-semibold text-base leading-snug">
            {THREAD.subject}
          </h3>
          <p className="flex gap-1">
            {THREAD.labels.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </p>
        </header>
        {MESSAGE && (
          <div className="grid gap-1 px-4 py-3">
            <p className="font-medium text-ui">{INBOX_PEOPLE[MESSAGE.from]}</p>
            <Markdown className="text-ui">{MESSAGE.body}</Markdown>
          </div>
        )}
        <form
          aria-label="Reply"
          onSubmit={(event) => event.preventDefault()}
          className="flex gap-2 border-t p-3"
        >
          <Input aria-label="Reply" placeholder="Reply in markdown…" />
          <Button type="submit">
            <SendIcon />
            Send
          </Button>
        </form>
      </article>
    </TooltipProvider>
  );
}
