import { PROJECTS } from "@orz/fixtures/projects.ts";
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
import { MatchedText, matchText } from "@orz/ui/components/filter-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CopyIcon, FolderInputIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { fn } from "storybook/test";

const meta = {
  title: "ui/Primitives/DropdownMenu",
  component: DropdownMenu,
  parameters: { guidelines: "/guidelines/patterns/overlays/" },
  args: { onOpenChange: fn() },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: function Render(args) {
    const [wrap, setWrap] = useState(true);
    const [sort, setSort] = useState("updated");
    return (
      <DropdownMenu {...args}>
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

export const FilteredSubmenu: Story = {
  render: function Render(args) {
    const [query, setQuery] = useState("");
    const shown = PROJECTS.filter(
      (project) =>
        matchText(project.name, query) || matchText(project.key, query),
    );
    return (
      <DropdownMenu {...args}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuItem>
            <PencilIcon /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CopyIcon /> Copy link
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInputIcon /> Move to project
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              query={query}
              onQueryChange={setQuery}
              placeholder="Filter projects…"
              inputLabel="Filter projects"
            >
              {shown.map((project) => (
                <DropdownMenuItem key={project.key} asChild>
                  <a href={`#${project.key.toLowerCase()}`}>
                    <MatchedText text={project.name} query={query} />
                    <span className="ml-auto text-ui-sm text-muted-foreground">
                      <MatchedText text={project.key} query={query} />
                    </span>
                  </a>
                </DropdownMenuItem>
              ))}
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
  render: (args) => (
    <DropdownMenu {...args}>
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
