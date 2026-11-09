import {
  INBOX_PEOPLE,
  INBOX_THREADS,
  type InboxThread,
} from "@orz/fixtures/inbox.ts";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import { Pane } from "@orz/ui/components/pane";
import { ToolbarButton } from "@orz/ui/components/toolbar";
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
      <Pane
        purpose="panel"
        frame="card"
        asChild
        className="flex flex-col overflow-hidden"
      >
        <article>
          <Pane
            purpose="toolbar"
            edge="bottom"
            className="flex gap-0.5 px-2 py-1"
          >
            {ACTIONS.map(({ label, Icon }) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <ToolbarButton size="icon-sm" aria-label={label}>
                    <Icon />
                  </ToolbarButton>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </Pane>
          <Pane purpose="document">
            <header className="grid gap-1 px-4 pt-3">
              <h3 className="font-semibold text-prose leading-snug">
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
                <p className="font-medium text-ui">
                  {INBOX_PEOPLE[MESSAGE.from]}
                </p>
                <Markdown className="text-ui">{MESSAGE.body}</Markdown>
              </div>
            )}
          </Pane>
          <Pane purpose="panel" edge="top" asChild className="flex gap-2 p-3">
            <form
              aria-label="Reply"
              onSubmit={(event) => event.preventDefault()}
            >
              <Input aria-label="Reply" placeholder="Reply in markdown…" />
              <Button type="submit">
                <SendIcon />
                Send
              </Button>
            </form>
          </Pane>
        </article>
      </Pane>
    </TooltipProvider>
  );
}
