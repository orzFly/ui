import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@orz/ui/components/sheet";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Primitives/Sheet",
  component: Sheet,
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Edit profile</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>
            Changes apply when you save; closing the sheet drops them.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-2 px-4">
          <Label htmlFor="sheet-name">Name</Label>
          <Input id="sheet-name" defaultValue="alice" />
        </div>
        <SheetFooter>
          <Button>Save</Button>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const ClearOverlay: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open side panel</Button>
      </SheetTrigger>
      <SheetContent overlay="clear">
        <SheetHeader>
          <SheetTitle>Side panel</SheetTitle>
          <SheetDescription>
            The page stays undimmed behind it; a click outside still closes the
            sheet.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};

export const Left: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open from the left</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Slides in from the start edge.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};
