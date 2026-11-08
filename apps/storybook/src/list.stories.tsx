import { List, ListItem, ListLabel } from "@orz/ui/components/list";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileTextIcon, InboxIcon, SendIcon, StarIcon } from "lucide-react";

const ROWS = [
  { label: "Inbox", Icon: InboxIcon },
  { label: "Starred", Icon: StarIcon },
  { label: "Sent", Icon: SendIcon },
  { label: "Drafts", Icon: FileTextIcon },
];

const row = "flex min-h-8 w-full items-center gap-2 px-2.5 text-left text-ui";

const meta = {
  title: "ui/Primitives/List",
  component: List,
  args: { purpose: "nav", orientation: "vertical", className: "w-56" },
  argTypes: {
    purpose: { control: "inline-radio", options: ["nav", "listbox", "menu"] },
    orientation: {
      control: "inline-radio",
      options: ["vertical", "horizontal"],
    },
  },
  render: (args) => (
    <List {...args}>
      <ListLabel className="px-2.5 py-1">Folders</ListLabel>
      <ul>
        {ROWS.map(({ label, Icon }, i) => (
          <li key={label}>
            <ListItem asChild current={i === 0} selected={i === 1}>
              <button type="button" className={row}>
                <Icon className="size-4 text-muted-foreground" />
                {label}
              </button>
            </ListItem>
          </li>
        ))}
      </ul>
    </List>
  ),
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The same rows under each purpose: switch the toolbar's Style to Raymond to see them part. */
export const Purposes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-start gap-6">
      {(["nav", "listbox", "menu"] as const).map((purpose) => (
        <List key={purpose} {...args} purpose={purpose}>
          <ListLabel className="px-2.5 py-1">{purpose}</ListLabel>
          <ul>
            {ROWS.map(({ label, Icon }, i) => (
              <li key={label}>
                <ListItem
                  asChild
                  current={purpose === "nav" && i === 0}
                  selected={purpose === "listbox" && i === 1}
                >
                  <button type="button" className={row}>
                    <Icon className="size-4 text-muted-foreground" />
                    {label}
                  </button>
                </ListItem>
              </li>
            ))}
          </ul>
        </List>
      ))}
    </div>
  ),
};
