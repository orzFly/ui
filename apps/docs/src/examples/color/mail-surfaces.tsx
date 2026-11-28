import { INBOX_PEOPLE, INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import { InlineCode } from "@orz/ui/components/inline-code";
import { List, ListItem } from "@orz/ui/components/list";
import {
  NavList,
  NavListCount,
  NavListFrame,
  NavListItem,
  NavListLink,
} from "@orz/ui/components/nav-list";
import { Pane } from "@orz/ui/components/pane";
import { Timestamp } from "@orz/ui/components/timestamp";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
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

const ROWS = ["touch-sizes", "contrast-audit", "flaky-retry"].flatMap((id) => {
  const thread = INBOX_THREADS.find((each) => each.id === id);
  const last = thread?.messages.at(-1);
  return thread && last ? [{ thread, last }] : [];
});

export function MailSurfaces() {
  const [folder, setFolder] = useState("Inbox");
  const [open, setOpen] = useState("touch-sizes");
  return (
    <TooltipProvider>
      <Pane
        purpose="app"
        frame="card"
        className="grid overflow-hidden sm:grid-cols-[10rem_1fr]"
      >
        <Pane
          purpose="sidebar"
          edge="end"
          className="grid content-start gap-3 p-2 touch:pt-hit-sm max-sm:hidden"
        >
          <Button size="sm" className="justify-start">
            <SquarePenIcon />
            Compose
          </Button>
          <NavListFrame asChild>
            <nav aria-label="Folders">
              <NavList>
                {FOLDERS.map(({ title, Icon, count }) => (
                  <NavListItem key={title}>
                    <NavListLink current={title === folder} asChild>
                      <button type="button" onClick={() => setFolder(title)}>
                        <Icon />
                        {title}
                        {count && <NavListCount>{count}</NavListCount>}
                      </button>
                    </NavListLink>
                  </NavListItem>
                ))}
              </NavList>
            </nav>
          </NavListFrame>
        </Pane>
        <Pane purpose="panel" className="min-w-0">
          <Pane
            purpose="toolbar"
            edge="bottom"
            className="flex items-center gap-2 px-3 py-3"
          >
            <span className="font-medium text-ui">{folder}</span>
          </Pane>
          <List purpose="listbox">
            <ul aria-label="Conversations">
              {ROWS.map(({ thread, last }) => (
                <ListItem key={thread.id} selected={thread.id === open} asChild>
                  <li className="flex items-start">
                    <button
                      type="button"
                      aria-current={thread.id === open ? "true" : undefined}
                      onClick={() => setOpen(thread.id)}
                      className="grid min-w-0 flex-1 grid-cols-[1fr_auto] gap-x-2 px-3 py-2.5 text-left"
                    >
                      <span className="truncate font-medium text-ui">
                        {INBOX_PEOPLE[last.from] ?? last.from}
                      </span>
                      <Timestamp
                        value={last.at}
                        format="date"
                        className="text-muted-foreground text-ui-sm"
                      />
                      <span className="col-span-2 truncate text-ui">
                        {thread.subject}
                      </span>
                      <span className="col-span-2 truncate text-muted-foreground text-ui-sm">
                        {last.body
                          .split("`")
                          .map((part, index) =>
                            index % 2 === 1 ? (
                              <InlineCode key={part}>{part}</InlineCode>
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
                                className="mt-2 mr-2 touch:mr-hit-xs"
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
                          <DropdownMenuItem
                            onSelect={() => toast("Link copied")}
                          >
                            <LinkIcon />
                            Copy link
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                </ListItem>
              ))}
            </ul>
          </List>
        </Pane>
      </Pane>
    </TooltipProvider>
  );
}
