import { TOKENS } from "@orz/fixtures/account.ts";
import { INBOX_LABELS, INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { PULL_REQUEST } from "@orz/fixtures/pull-request.ts";
import { Button } from "@orz/ui/components/button";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import { EmptyState } from "@orz/ui/components/empty-state";
import { GroupHeading } from "@orz/ui/components/group-heading";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@orz/ui/components/hover-card";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import { NavList, NavListItem, NavListLink } from "@orz/ui/components/nav-list";
import { Pane } from "@orz/ui/components/pane";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@orz/ui/components/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@orz/ui/components/sheet";
import { TextLink } from "@orz/ui/components/text-link";
import { ToolbarButton } from "@orz/ui/components/toolbar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import {
  ArchiveIcon,
  FileTextIcon,
  InboxIcon,
  KeyRoundIcon,
  PanelLeftIcon,
  PencilIcon,
  SendIcon,
  StarIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

const FOLDERS = [
  { title: "Inbox", Icon: InboxIcon },
  { title: "Starred", Icon: StarIcon },
  { title: "Sent", Icon: SendIcon },
  { title: "Drafts", Icon: FileTextIcon },
  { title: "Archive", Icon: ArchiveIcon },
  { title: "Trash", Icon: Trash2Icon },
];

const THREAD = INBOX_THREADS.find(({ id }) => id === "touch-sizes");

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-1.5">
      <GroupHeading asChild>
        <h3>{title}</h3>
      </GroupHeading>
      <Pane purpose="panel" frame="card" className="min-w-0 p-2">
        {children}
      </Pane>
    </section>
  );
}

export function OverlayKinds() {
  const [starred, setStarred] = useState(THREAD?.starred ?? false);
  const [labels, setLabels] = useState(THREAD?.labels ?? []);
  const [token, setToken] = useState(TOKENS[0]?.name ?? "");
  const [renaming, setRenaming] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);
  return (
    <TooltipProvider>
      <div className="grid min-w-0 gap-4">
        <Panel title="Mail">
          <Pane purpose="toolbar" className="flex items-center gap-0.5">
            <Sheet>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SheetTrigger asChild>
                    <ToolbarButton aria-label="Folders">
                      <PanelLeftIcon />
                    </ToolbarButton>
                  </SheetTrigger>
                </TooltipTrigger>
                <TooltipContent>Folders</TooltipContent>
              </Tooltip>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle>Folders</SheetTitle>
                </SheetHeader>
                <nav aria-label="Folders" className="px-2">
                  <NavList>
                    {FOLDERS.map(({ title, Icon }) => (
                      <NavListItem key={title}>
                        <SheetClose asChild>
                          <NavListLink current={title === "Inbox"} asChild>
                            <button type="button">
                              <Icon />
                              {title}
                            </button>
                          </NavListLink>
                        </SheetClose>
                      </NavListItem>
                    ))}
                  </NavList>
                </nav>
              </SheetContent>
            </Sheet>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToolbarButton
                  aria-label="Star"
                  aria-pressed={starred}
                  onClick={() => setStarred(!starred)}
                >
                  <StarIcon className={starred ? "fill-current" : undefined} />
                </ToolbarButton>
              </TooltipTrigger>
              <TooltipContent>Star</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <ToolbarButton aria-label="Labels">
                      <TagIcon />
                    </ToolbarButton>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Labels</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuLabel>Labels</DropdownMenuLabel>
                {INBOX_LABELS.map((label) => (
                  <DropdownMenuCheckboxItem
                    key={label}
                    checked={labels.includes(label)}
                    onCheckedChange={(on) =>
                      setLabels((was) =>
                        on ? [...was, label] : was.filter((l) => l !== label),
                      )
                    }
                    onSelect={(event) => event.preventDefault()}
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="min-w-0 truncate px-1 text-ui">
              {THREAD?.subject}
            </span>
          </Pane>
        </Panel>
        <Panel title="Access tokens">
          {revoked ? (
            <EmptyState title="No access tokens" className="p-1">
              Scripts and bots that need one get it from the command line.
            </EmptyState>
          ) : (
            <div className="flex items-center gap-2">
              <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-mono text-ui">
                {token}
              </span>
              <Popover open={renaming} onOpenChange={setRenaming}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Rename ${token}`}
                      >
                        <PencilIcon />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Rename</TooltipContent>
                </Tooltip>
                <PopoverContent align="end" className="w-64">
                  <form
                    className="grid gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const name = new FormData(event.currentTarget).get(
                        "name",
                      );
                      if (typeof name === "string" && name.trim() !== "") {
                        setToken(name.trim());
                        toast(`Renamed the token to ${name.trim()}`);
                      }
                      setRenaming(false);
                    }}
                  >
                    <Label htmlFor="overlay-token-name">Token name</Label>
                    <Input
                      id="overlay-token-name"
                      name="name"
                      defaultValue={token}
                      autoComplete="off"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="justify-self-end"
                    >
                      Rename
                    </Button>
                  </form>
                </PopoverContent>
              </Popover>
              <Button variant="destructive" onClick={() => setRevoking(true)}>
                Revoke…
              </Button>
              <ConfirmDialog
                open={revoking}
                onOpenChange={setRevoking}
                title={`Revoke the token for ${token}?`}
                description="Anything that signs in with it stops working at once. A revoked token cannot be restored: you would create a new one and update everything that used the old."
                confirmLabel="Revoke"
                destructive
                onConfirm={() => {
                  setRevoking(false);
                  setRevoked(true);
                  toast(`Revoked the token for ${token}`);
                }}
              />
            </div>
          )}
        </Panel>
        <Panel title="Pull request">
          <p className="px-1 text-muted-foreground text-ui">
            <HoverCard>
              <HoverCardTrigger asChild>
                <TextLink href={`#${PULL_REQUEST.author}`}>
                  {PULL_REQUEST.author}
                </TextLink>
              </HoverCardTrigger>
              <HoverCardContent className="w-72">
                <p className="font-medium text-ui">{PULL_REQUEST.author}</p>
                <p className="text-muted-foreground text-ui">
                  Opened #{PULL_REQUEST.number} in {PULL_REQUEST.repo.owner}/
                  {PULL_REQUEST.repo.name}: {PULL_REQUEST.title}
                </p>
              </HoverCardContent>
            </HoverCard>{" "}
            opened this pull request
          </p>
        </Panel>
      </div>
    </TooltipProvider>
  );
}
