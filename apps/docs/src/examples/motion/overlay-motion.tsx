import { Button } from "@orz/ui/components/button";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
      <div className="flex flex-wrap items-center gap-1">
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
          <SheetContent side="left" className="w-64 p-2 pt-12">
            <SheetTitle className="sr-only">Folders</SheetTitle>
            <SheetDescription className="sr-only">
              Mail's folders
            </SheetDescription>
            <ul className="grid gap-0.5">
              {PLACES.map(({ title, Icon }) => (
                <li key={title}>
                  <Button variant="ghost" className="w-full justify-start">
                    <Icon data-icon="inline-start" /> {title}
                  </Button>
                </li>
              ))}
            </ul>
          </SheetContent>
        </Sheet>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Archive">
              <ArchiveIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Archive</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <EllipsisIcon />
                </Button>
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
            <Button variant="ghost">
              <KeyboardIcon data-icon="inline-start" /> Keyboard shortcuts
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Keyboard shortcuts</DialogTitle>
              <DialogDescription>
                Single keys, for when the focus is not in a field.
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
              {KEYS.map(({ key, label }) => (
                <div key={key} className="contents">
                  <dt>{label}</dt>
                  <dd className="justify-self-end">
                    <kbd className="rounded-sm border bg-muted px-1.5 font-mono text-muted-foreground text-xs">
                      {key}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
