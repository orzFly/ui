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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@orz/ui/components/hover-card";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
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
      <h3 className="font-medium text-muted-foreground text-xs">{title}</h3>
      <div className="min-w-0 rounded-lg border p-2">{children}</div>
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
          <div className="flex items-center gap-0.5">
            <Sheet>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Folders">
                      <PanelLeftIcon />
                    </Button>
                  </SheetTrigger>
                </TooltipTrigger>
                <TooltipContent>Folders</TooltipContent>
              </Tooltip>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle>Folders</SheetTitle>
                </SheetHeader>
                <ul className="grid gap-0.5 px-2">
                  {FOLDERS.map(({ title, Icon }) => (
                    <li key={title}>
                      <SheetClose asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                        >
                          <Icon />
                          {title}
                        </Button>
                      </SheetClose>
                    </li>
                  ))}
                </ul>
              </SheetContent>
            </Sheet>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Star"
                  aria-pressed={starred}
                  onClick={() => setStarred(!starred)}
                >
                  <StarIcon className={starred ? "fill-current" : undefined} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Star</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Labels">
                      <TagIcon />
                    </Button>
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
            <span className="min-w-0 truncate px-1 text-sm">
              {THREAD?.subject}
            </span>
          </div>
        </Panel>
        <Panel title="Access tokens">
          {revoked ? (
            <p className="p-1 text-muted-foreground text-sm">
              No access tokens. Scripts and bots that need one get it from the
              command line.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-mono text-sm">
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
          <p className="px-1 text-muted-foreground text-sm">
            <HoverCard>
              <HoverCardTrigger asChild>
                <a
                  href={`#${PULL_REQUEST.author}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {PULL_REQUEST.author}
                </a>
              </HoverCardTrigger>
              <HoverCardContent className="w-72 text-sm">
                <p className="font-medium">{PULL_REQUEST.author}</p>
                <p className="text-muted-foreground">
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
