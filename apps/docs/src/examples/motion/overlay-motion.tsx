import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@orz/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import { Kbd } from "@orz/ui/components/kbd";
import { NavList, NavListItem, NavListLink } from "@orz/ui/components/nav-list";
import { Pane } from "@orz/ui/components/pane";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@orz/ui/components/sheet";
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
  FileTextIcon,
  ForwardIcon,
  InboxIcon,
  KeyboardIcon,
  LinkIcon,
  PanelLeftIcon,
  SendIcon,
} from "lucide-react";

const KEYS = [
  { key: "E", label: "Archive" },
  { key: "#", label: "Delete" },
  { key: "S", label: "Star" },
  { key: "C", label: "Compose" },
];

const PLACES = [
  { title: "Inbox", Icon: InboxIcon },
  { title: "Sent", Icon: SendIcon },
  { title: "Drafts", Icon: FileTextIcon },
  { title: "Archive", Icon: ArchiveIcon },
];

export function OverlayMotion() {
  return (
    <TooltipProvider>
      <Pane purpose="toolbar" className="flex flex-wrap items-center gap-1">
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
          <SheetContent side="left" className="w-64">
            <SheetHeader>
              <SheetTitle>Folders</SheetTitle>
              <SheetDescription className="sr-only">
                Mail's folders
              </SheetDescription>
            </SheetHeader>
            <nav aria-label="Folders" className="px-2">
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
          </SheetContent>
        </Sheet>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarButton aria-label="Archive">
              <ArchiveIcon />
            </ToolbarButton>
          </TooltipTrigger>
          <TooltipContent>Archive</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <ToolbarButton aria-label="More actions">
                  <EllipsisIcon />
                </ToolbarButton>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>More actions</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem>
              <ForwardIcon /> Forward
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LinkIcon /> Copy link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog>
          <DialogTrigger asChild>
            <ToolbarButton size="default">
              <KeyboardIcon data-icon="inline-start" /> Keyboard shortcuts
            </ToolbarButton>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Keyboard shortcuts</DialogTitle>
              <DialogDescription>
                Single keys, for when the focus is not in a field.
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-ui">
              {KEYS.map(({ key, label }) => (
                <div key={key} className="contents">
                  <dt>{label}</dt>
                  <dd className="justify-self-end">
                    <Kbd>{key}</Kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </DialogContent>
        </Dialog>
      </Pane>
    </TooltipProvider>
  );
}
