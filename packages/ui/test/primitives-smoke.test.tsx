import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "../src/components/avatar.tsx";
import { Badge } from "../src/components/badge.tsx";
import { Button } from "../src/components/button.tsx";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../src/components/card.tsx";
import { ConfirmDialog } from "../src/components/confirm-dialog.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../src/components/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../src/components/dropdown-menu.tsx";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../src/components/hover-card.tsx";
import { Input } from "../src/components/input.tsx";
import { Label } from "../src/components/label.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../src/components/popover.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../src/components/select.tsx";
import { Separator } from "../src/components/separator.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../src/components/sheet.tsx";
import { Skeleton } from "../src/components/skeleton.tsx";
import { Slider } from "../src/components/slider.tsx";
import { Toaster } from "../src/components/sonner.tsx";
import { Switch } from "../src/components/switch.tsx";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../src/components/table.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../src/components/tabs.tsx";
import { Textarea } from "../src/components/textarea.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../src/components/tooltip.tsx";

/** One tree per file in src/components/, each carrying a `data-slot` to find. */
const CASES: [file: string, slot: string, tree: ReactElement][] = [
  [
    "avatar",
    "avatar-group-count",
    <AvatarGroup key="a">
      <Avatar>
        <AvatarImage src="" alt="" />
        <AvatarFallback>AB</AvatarFallback>
        <AvatarBadge />
      </Avatar>
      <AvatarGroupCount>+3</AvatarGroupCount>
    </AvatarGroup>,
  ],
  ["badge", "badge", <Badge key="a">New</Badge>],
  ["button", "button", <Button key="a">Go</Button>],
  [
    "card",
    "card-footer",
    <Card key="a">
      <CardHeader>
        <CardTitle>Title</CardTitle>
        <CardDescription>Description</CardDescription>
        <CardAction>Action</CardAction>
      </CardHeader>
      <CardContent>Body</CardContent>
      <CardFooter>Footer</CardFooter>
    </Card>,
  ],
  [
    "confirm-dialog",
    "dialog-content",
    <ConfirmDialog
      key="a"
      open
      onOpenChange={() => {}}
      title="Delete?"
      description="This cannot be undone."
      destructive
      onConfirm={() => {}}
    />,
  ],
  [
    "dialog",
    "dialog-footer",
    <Dialog key="a" open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>,
  ],
  [
    "dropdown-menu",
    "dropdown-menu-sub-trigger",
    <DropdownMenu key="a" open>
      <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Label</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem>
            Item <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem checked>Check</DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value="a">
          <DropdownMenuRadioItem value="a">A</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>,
  ],
  [
    "hover-card",
    "hover-card-content",
    <HoverCard key="a" open>
      <HoverCardTrigger>Hover</HoverCardTrigger>
      <HoverCardContent>Card</HoverCardContent>
    </HoverCard>,
  ],
  ["input", "input", <Input key="a" />],
  ["label", "label", <Label key="a">Name</Label>],
  [
    "popover",
    "popover-content",
    <Popover key="a" open>
      <PopoverTrigger>Open</PopoverTrigger>
      <PopoverContent>Body</PopoverContent>
    </Popover>,
  ],
  [
    "select",
    "select-trigger",
    <Select key="a">
      <SelectTrigger>
        <SelectValue placeholder="Pick" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">A</SelectItem>
      </SelectContent>
    </Select>,
  ],
  ["separator", "separator", <Separator key="a" />],
  [
    "sheet",
    "sheet-footer",
    <Sheet key="a" open>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Title</SheetTitle>
          <SheetDescription>Description</SheetDescription>
        </SheetHeader>
        <SheetFooter>Footer</SheetFooter>
      </SheetContent>
    </Sheet>,
  ],
  ["skeleton", "skeleton", <Skeleton key="a" />],
  [
    "slider",
    "slider-thumb",
    <Slider key="a" defaultValue={[40]} aria-label="Volume" />,
  ],
  ["switch", "switch-thumb", <Switch key="a" />],
  [
    "table",
    "table-caption",
    <Table key="a">
      <TableCaption>Caption</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Head</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Cell</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Foot</TableCell>
        </TableRow>
      </TableFooter>
    </Table>,
  ],
  [
    "tabs",
    "tabs-content",
    <Tabs key="a" defaultValue="a">
      <TabsList>
        <TabsTrigger value="a">A</TabsTrigger>
      </TabsList>
      <TabsContent value="a">Panel</TabsContent>
    </Tabs>,
  ],
  ["textarea", "textarea", <Textarea key="a" />],
  [
    "tooltip",
    "tooltip-content",
    <TooltipProvider key="a">
      <Tooltip open>
        <TooltipTrigger>Hint</TooltipTrigger>
        <TooltipContent>Tip</TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  ],
];

describe("every primitive renders", () => {
  it.each(CASES)("%s", (_file, slot, tree) => {
    render(tree);
    expect(document.querySelector(`[data-slot="${slot}"]`)).not.toBeNull();
  });

  it("sheet is a dialog named by its title", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Edit theme</SheetTitle>
          <SheetDescription>Description</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByRole("dialog", { name: "Edit theme" })).toBeTruthy();
    const overlay = document.querySelector('[data-slot="sheet-overlay"]');
    expect(overlay?.className).toMatch(/\bbg-/);
  });

  it("sheet with a clear overlay paints no background", () => {
    render(
      <Sheet open>
        <SheetContent overlay="clear">
          <SheetTitle>Edit theme</SheetTitle>
          <SheetDescription>Description</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    const overlay = document.querySelector('[data-slot="sheet-overlay"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.className).not.toMatch(/\bbg-/);
    expect(overlay?.className).not.toMatch(/backdrop-blur/);
  });

  it("slider is a slider carrying its value", () => {
    render(<Slider value={[30]} max={120} aria-label="Seek" />);
    const thumb = screen.getByRole("slider");
    expect(thumb.getAttribute("aria-valuenow")).toBe("30");
    expect(thumb.getAttribute("aria-valuemax")).toBe("120");
  });

  it("sonner", () => {
    render(<Toaster />);
    expect(screen.getByRole("region")).toBeTruthy();
  });
});
