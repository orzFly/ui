import { INBOX_PEOPLE, INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@orz/ui/components/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { cn } from "@orz/ui/lib/utils";
import { Markdown } from "@orz/ui-markdown";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  FileTextIcon,
  InboxIcon,
  PanelLeftIcon,
  SendIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { type ComponentProps, useState } from "react";

const PLACES = [
  { title: "Inbox", Icon: InboxIcon },
  { title: "Starred", Icon: StarIcon },
  { title: "Sent", Icon: SendIcon },
  { title: "Drafts", Icon: FileTextIcon },
  { title: "Archive", Icon: ArchiveIcon },
  { title: "Trash", Icon: Trash2Icon },
];

const THREADS = INBOX_THREADS.filter((thread) => !thread.folder).slice(0, 5);

function Folders() {
  return (
    <ul className="grid gap-0.5">
      {PLACES.map(({ title, Icon }) => (
        <li key={title}>
          <Button
            variant={title === "Inbox" ? "secondary" : "ghost"}
            className="w-full justify-start"
          >
            <Icon data-icon="inline-start" /> {title}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function IconButton({
  label,
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} {...props} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function MailPanes() {
  const [open, setOpen] = useState<string | null>(null);
  const [folders, setFolders] = useState(false);
  const thread = THREADS.find(({ id }) => id === open);
  return (
    <TooltipProvider>
      <div className="flex h-96 overflow-hidden rounded-lg border">
        <nav
          aria-label="Folders"
          className="w-40 shrink-0 border-r bg-sidebar p-2 text-sidebar-foreground max-lg:hidden"
        >
          <Folders />
        </nav>
        <section
          aria-label="Conversations"
          className={cn(
            "flex min-w-0 flex-1 flex-col md:w-56 md:flex-none md:border-r",
            thread && "max-md:hidden",
          )}
        >
          <div className="flex h-11 shrink-0 items-center gap-1 border-b px-2">
            <IconButton
              label="Folders"
              className="lg:hidden"
              onClick={() => setFolders(true)}
            >
              <PanelLeftIcon />
            </IconButton>
            <span className="px-1 font-medium text-ui">Inbox</span>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto py-1">
            {THREADS.map((each) => (
              <li key={each.id}>
                <button
                  type="button"
                  aria-current={each.id === open ? "true" : undefined}
                  onClick={() => setOpen(each.id)}
                  className={cn(
                    "grid w-full px-3 py-2 text-left transition-colors hover:bg-accent/60",
                    each.id === open && "bg-accent",
                  )}
                >
                  <span className="truncate text-muted-foreground text-ui-sm">
                    {INBOX_PEOPLE[each.messages[0]?.from ?? ""]}
                  </span>
                  <span className="truncate text-ui">{each.subject}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <article
          aria-label="Conversation"
          className={cn(
            "min-w-0 flex-1 flex-col",
            thread ? "flex" : "max-md:hidden md:flex",
          )}
        >
          {thread ? (
            <>
              <div className="flex h-11 shrink-0 items-center gap-1 border-b px-2">
                <IconButton
                  label="Back to inbox"
                  className="md:hidden"
                  onClick={() => setOpen(null)}
                >
                  <ArrowLeftIcon />
                </IconButton>
                <h3 className="truncate px-1 font-medium text-ui">
                  {thread.subject}
                </h3>
              </div>
              <Markdown className="min-h-0 flex-1 overflow-y-auto p-4 text-ui">
                {thread.messages[0]?.body ?? ""}
              </Markdown>
            </>
          ) : (
            <p className="grid flex-1 place-content-center p-4 text-muted-foreground text-ui">
              Pick a conversation to read it.
            </p>
          )}
        </article>
        <Sheet open={folders} onOpenChange={setFolders}>
          <SheetContent side="left" className="w-64 p-2 pt-12">
            <SheetTitle className="sr-only">Folders</SheetTitle>
            <SheetDescription className="sr-only">
              Mail's folders
            </SheetDescription>
            <Folders />
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
