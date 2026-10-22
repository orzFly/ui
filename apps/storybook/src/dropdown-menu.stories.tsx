import { Button } from "@orz/ui/components/button";
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
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CopyIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useState } from "react";

const meta = {
  title: "Primitives/DropdownMenu",
  component: DropdownMenu,
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    const [wrap, setWrap] = useState(true);
    const [sort, setSort] = useState("updated");
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Item</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <PencilIcon /> Edit
              <DropdownMenuShortcut>E</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <CopyIcon /> Copy link
              <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>Move (disabled)</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={wrap} onCheckedChange={setWrap}>
            Wrap lines
          </DropdownMenuCheckboxItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Sort by</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
                <DropdownMenuRadioItem value="updated">
                  Updated
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="created">
                  Created
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="title">
                  Title
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <TrashIcon /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};

export const Inset: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Inset items</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuLabel inset>Aligned label</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked>
          With a check
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem inset>Inset to match</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
