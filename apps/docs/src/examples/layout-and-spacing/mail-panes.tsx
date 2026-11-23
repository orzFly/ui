import { INBOX_PEOPLE, INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { List, ListItem } from "@orz/ui/components/list";
import {
  NavList,
  NavListFrame,
  NavListItem,
  NavListLink,
} from "@orz/ui/components/nav-list";
import { Pane } from "@orz/ui/components/pane";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@orz/ui/components/sheet";
import { ToolbarButton } from "@orz/ui/components/toolbar";
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
import { useState } from "react";

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
    <NavListFrame asChild>
      <nav aria-label="Folders" className="h-full">
        <NavList>
          {PLACES.map(({ title, Icon }) => (
            <NavListItem key={title}>
              <NavListLink current={title === "Inbox"} asChild>
                <button type="button">
                  <Icon />
                  {title}
                </button>
              </NavListLink>
            </NavListItem>
          ))}
        </NavList>
      </nav>
    </NavListFrame>
  );
}

export function MailPanes() {
  const [open, setOpen] = useState<string | null>(null);
  const [folders, setFolders] = useState(false);
  const thread = THREADS.find(({ id }) => id === open);
  return (
    <TooltipProvider>
      <Pane purpose="app" frame="card" className="flex h-96 overflow-hidden">
        <Pane
          purpose="sidebar"
          edge="end"
          className="w-40 shrink-0 p-2 max-lg:hidden"
        >
          <Folders />
        </Pane>
        <Pane
          purpose="panel"
          edge={{ md: "end" }}
          asChild
          className={cn(
            "flex min-w-0 flex-1 flex-col md:w-56 md:flex-none",
            thread && "max-md:hidden",
          )}
        >
          <section aria-label="Conversations">
            <Pane
              purpose="toolbar"
              edge="bottom"
              className="flex shrink-0 items-center gap-1 px-2 py-1.5"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToolbarButton
                    size="icon-sm"
                    aria-label="Folders"
                    className="lg:hidden"
                    onClick={() => setFolders(true)}
                  >
                    <PanelLeftIcon />
                  </ToolbarButton>
                </TooltipTrigger>
                <TooltipContent>Folders</TooltipContent>
              </Tooltip>
              <span className="px-1 font-medium text-ui">Inbox</span>
            </Pane>
            <List purpose="listbox" className="flex min-h-0 flex-1 flex-col">
              <ul className="min-h-0 flex-1 overflow-y-auto py-1">
                {THREADS.map((each) => (
                  <li key={each.id}>
                    <ListItem selected={each.id === open} asChild>
                      <button
                        type="button"
                        aria-current={each.id === open ? "true" : undefined}
                        onClick={() => setOpen(each.id)}
                        className="grid w-full px-3 py-2 text-left"
                      >
                        <span className="truncate text-muted-foreground text-ui-sm">
                          {INBOX_PEOPLE[each.messages[0]?.from ?? ""]}
                        </span>
                        <span className="truncate text-ui">{each.subject}</span>
                      </button>
                    </ListItem>
                  </li>
                ))}
              </ul>
            </List>
          </section>
        </Pane>
        <Pane
          purpose="panel"
          asChild
          className={cn(
            "min-w-0 flex-1 flex-col",
            thread ? "flex" : "max-md:hidden md:flex",
          )}
        >
          <article aria-label="Conversation">
            {thread ? (
              <>
                <Pane
                  purpose="toolbar"
                  edge="bottom"
                  className="flex shrink-0 items-center gap-1 px-2 py-1.5"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ToolbarButton
                        size="icon-sm"
                        aria-label="Back to inbox"
                        className="md:hidden"
                        onClick={() => setOpen(null)}
                      >
                        <ArrowLeftIcon />
                      </ToolbarButton>
                    </TooltipTrigger>
                    <TooltipContent>Back to inbox</TooltipContent>
                  </Tooltip>
                  <h3 className="truncate px-1 font-medium text-ui">
                    {thread.subject}
                  </h3>
                </Pane>
                <Pane
                  purpose="document"
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <Markdown className="min-h-0 flex-1 overflow-y-auto p-4 text-ui">
                    {thread.messages[0]?.body ?? ""}
                  </Markdown>
                </Pane>
              </>
            ) : (
              <Pane
                purpose="document"
                className="grid flex-1 place-content-center p-4"
              >
                <p className="text-muted-foreground text-ui">
                  Pick a conversation to read it.
                </p>
              </Pane>
            )}
          </article>
        </Pane>
        <Sheet open={folders} onOpenChange={setFolders}>
          <SheetContent side="left" className="w-64 p-2 pt-12">
            <SheetTitle className="sr-only">Folders</SheetTitle>
            <SheetDescription className="sr-only">
              Mail's folders
            </SheetDescription>
            <Folders />
          </SheetContent>
        </Sheet>
      </Pane>
    </TooltipProvider>
  );
}
