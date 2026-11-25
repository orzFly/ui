import { DropdownMenuItem } from "@orz/ui/components/dropdown-menu";
import {
  SplitButton,
  SplitButtonAction,
  SplitButtonMenu,
} from "@orz/ui/components/split-button";
import { Toolbar, ToolbarLabel } from "@orz/ui/components/toolbar";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { GitMergeIcon } from "lucide-react";
import { fn } from "storybook/test";

const VARIANTS = ["outline", "default", "secondary", "ghost"] as const;

// The toolbar the split button stands in, which draws it flat.
const withToolbar: Decorator = (Story) => (
  <Toolbar aria-label="Pull request" edge="bottom">
    <Story />
  </Toolbar>
);

const meta = {
  title: "ui/Primitives/SplitButton",
  component: SplitButton,
  parameters: { guidelines: "/guidelines/patterns/toolbars/" },
  args: {
    children: (
      <>
        <SplitButtonAction onClick={fn()}>
          <GitMergeIcon />
          Merge
        </SplitButtonAction>
        <SplitButtonMenu triggerLabel="Merge options">
          <DropdownMenuItem>Squash and merge</DropdownMenuItem>
          <DropdownMenuItem>Rebase and merge</DropdownMenuItem>
        </SplitButtonMenu>
      </>
    ),
  },
  argTypes: {
    children: { control: false },
    variant: { control: "select", options: VARIANTS },
    size: { control: "inline-radio", options: ["xs", "sm", "default", "lg"] },
    overflow: { control: "inline-radio", options: ["sub", "group"] },
  },
} satisfies Meta<typeof SplitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every variant joins its arrow on the same way: an outline's borders overlap, the rest are parted by a line in their own text colour. */
export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {VARIANTS.map((variant) => (
        <SplitButton key={variant} {...args} variant={variant} />
      ))}
    </div>
  ),
};

/** `disabled` on the split button disables both halves; on `SplitButtonMenu`, the arrow alone. */
export const Disabled: Story = {
  args: {
    children: (
      <>
        <SplitButtonAction>
          <GitMergeIcon />
          Merge
        </SplitButtonAction>
        <SplitButtonMenu triggerLabel="Merge options" disabled>
          <DropdownMenuItem>Squash and merge</DropdownMenuItem>
        </SplitButtonMenu>
      </>
    ),
  },
};

/** A command that goes somewhere is a link, through `asChild`, beside its arrow. */
export const AsLink: Story = {
  args: {
    children: (
      <>
        <SplitButtonAction asChild>
          <a href="#review">Review changes</a>
        </SplitButtonAction>
        <SplitButtonMenu triggerLabel="More ways to review">
          <DropdownMenuItem>Review file by file</DropdownMenuItem>
          <DropdownMenuItem>Review the latest push</DropdownMenuItem>
        </SplitButtonMenu>
      </>
    ),
  },
};

/**
 * In a `Toolbar` it is flat as the bar's commands are and takes the bar's
 * size; pointing at either half raises both under raymond. Its words, in a
 * `ToolbarLabel`, hide to fit as a `ToolbarButton`'s do.
 */
export const InToolbar: Story = {
  args: {
    children: (
      <>
        <SplitButtonAction>
          <GitMergeIcon />
          <ToolbarLabel>Merge</ToolbarLabel>
        </SplitButtonAction>
        <SplitButtonMenu triggerLabel="Merge options">
          <DropdownMenuItem>Squash and merge</DropdownMenuItem>
          <DropdownMenuItem>Rebase and merge</DropdownMenuItem>
        </SplitButtonMenu>
      </>
    ),
  },
  decorators: [withToolbar],
};
