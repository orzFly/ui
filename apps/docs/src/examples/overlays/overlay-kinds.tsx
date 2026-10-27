import { Button } from "@orz/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@orz/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@orz/ui/components/sheet";
import { Switch } from "@orz/ui/components/switch";
import { useState } from "react";

export function OverlayKinds() {
  const [sort, setSort] = useState("updated");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Rename…</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>
              The address of the project changes with its name.
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="ov-name" className="sr-only">
            Name
          </Label>
          <Input id="ov-name" defaultValue="orzui" />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button>Rename</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">View options</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>View options</SheetTitle>
            <SheetDescription>Changes apply as you make them.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="ov-closed">Show closed items</Label>
              <Switch id="ov-closed" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="ov-avatars">Show avatars</Label>
              <Switch id="ov-avatars" defaultChecked />
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Set width</Button>
        </PopoverTrigger>
        <PopoverContent className="grid gap-2 p-3">
          <Label htmlFor="ov-width">Column width</Label>
          <Input id="ov-width" defaultValue="240px" />
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Sort</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44">
          <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
            <DropdownMenuRadioItem value="updated">
              Last updated
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="created">
              Created
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="title">Title</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <HoverCard>
        <HoverCardTrigger asChild>
          <a href="#alice" className="text-sm underline underline-offset-4">
            @alice
          </a>
        </HoverCardTrigger>
        <HoverCardContent className="w-64 text-sm">
          <p className="font-medium">alice</p>
          <p className="text-muted-foreground">
            Maintains the theme editor. Last active today.
          </p>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
