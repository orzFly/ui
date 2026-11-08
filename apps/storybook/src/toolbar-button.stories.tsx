import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import {
  ToolbarButton,
  ToolbarSeparator as ToolbarSeparatorPart,
} from "@orz/ui/components/toolbar";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ArchiveIcon,
  EllipsisIcon,
  MailIcon,
  ReplyIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";

const TEXT_SIZES = ["xs", "sm", "default", "lg"] as const;
const ICON_SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;

// Docgen prints the props' type as written, VariantProps<…>["size"].
const union = (values: readonly string[]) => ({
  type: { summary: values.map((v) => `"${v}"`).join(" | ") },
});

const meta = {
  title: "ui/Primitives/ToolbarButton",
  component: ToolbarButton,
  parameters: { guidelines: "/guidelines/foundations/styles/" },
  args: { "aria-label": "Archive", children: <ArchiveIcon /> },
  argTypes: {
    size: {
      control: "select",
      options: [...TEXT_SIZES, ...ICON_SIZES],
      table: union([...TEXT_SIZES, ...ICON_SIZES]),
    },
  },
} satisfies Meta<typeof ToolbarButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A text size draws the icon with its text beside it, which names the command itself. */
export const Text: Story = {
  args: {
    "aria-label": undefined,
    size: "sm",
    children: (
      <>
        <ReplyIcon />
        Reply
      </>
    ),
  },
};

const COMMANDS = [
  { label: "Archive", Icon: ArchiveIcon },
  { label: "Delete", Icon: Trash2Icon },
  { label: "Mark as unread", Icon: MailIcon },
];

/** `ToolbarSeparator` parts groups of commands; switch the toolbar's Style to Raymond to see it etched. */
export const ToolbarSeparator: Story = {
  render: (args) => (
    <div className="flex items-center gap-0.5">
      {COMMANDS.map(({ label, Icon }) => (
        <ToolbarButton key={label} size={args.size} aria-label={label}>
          <Icon />
        </ToolbarButton>
      ))}
      <ToolbarSeparatorPart />
      <ToolbarButton size={args.size} aria-label="Star">
        <StarIcon />
      </ToolbarButton>
    </div>
  ),
};

/** A menu's trigger: raymond sinks it while the menu is open, as it does while it is held. */
export const Menu: Story = {
  args: { "aria-label": "More actions", children: <EllipsisIcon /> },
  render: (args) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarButton {...args} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem>Forward</DropdownMenuItem>
        <DropdownMenuItem>Print</DropdownMenuItem>
        <DropdownMenuItem>Show original</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
