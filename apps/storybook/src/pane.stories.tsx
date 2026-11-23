import { INBOX_PEOPLE, INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import {
  NavList,
  NavListFrame,
  NavListItem,
  NavListLink,
} from "@orz/ui/components/nav-list";
import { Pane } from "@orz/ui/components/pane";
import { ToolbarButton, ToolbarSeparator } from "@orz/ui/components/toolbar";
import { Markdown } from "@orz/ui-markdown";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ArchiveIcon,
  FileTextIcon,
  InboxIcon,
  MailIcon,
  MinusIcon,
  ReplyIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

const PURPOSES = [
  "app",
  "banner",
  "document",
  "toolbar",
  "statusbar",
  "panel",
  "window",
  "titlebar",
] as const;

const FOLDERS = [
  { title: "Inbox", Icon: InboxIcon },
  { title: "Sent", Icon: SendIcon },
  { title: "Drafts", Icon: FileTextIcon },
];

const THREAD = INBOX_THREADS.find(({ id }) => id === "touch-sizes");

const meta = {
  title: "ui/Primitives/Pane",
  component: Pane,
  parameters: { guidelines: "/guidelines/foundations/styles/" },
  args: {
    purpose: "document",
    className: "max-w-md p-4",
    children: "What is read or written: a message, a diff, an editor.",
  },
  argTypes: {
    purpose: { control: "inline-radio", options: PURPOSES },
    edge: {
      control: "inline-radio",
      options: ["none", "top", "bottom", "start", "end"],
    },
    docked: {
      control: "inline-radio",
      options: ["none", "top", "bottom", "start", "end", "fill"],
    },
    frame: { control: "inline-radio", options: [undefined, "card", "inset"] },
  },
} satisfies Meta<typeof Pane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { args: { frame: "card" } };

/**
 * An app's frame, each region marked with what it is for: switch the toolbar's Style to Raymond to
 * see the panes part on the face, the toolbar become a band, the document a sunken well and the
 * status bar a shallow sunken panel along the foot. The document's scroller sits inside it, so the
 * well stays drawn around what scrolls.
 */
export const App: Story = {
  args: {
    purpose: "app",
    className: "flex h-80 max-w-2xl overflow-hidden",
  },
  render: function Render(args) {
    const [current, setCurrent] = useState("Inbox");
    return (
      <Pane {...args}>
        <Pane purpose="sidebar" edge="end" asChild>
          <aside aria-label="Mail" className="flex w-40 shrink-0 flex-col p-2">
            <NavListFrame className="flex min-h-0 flex-1 flex-col">
              <nav
                aria-label="Folders"
                className="min-h-0 flex-1 overflow-y-auto"
              >
                <NavList>
                  {FOLDERS.map(({ title, Icon }) => (
                    <NavListItem key={title}>
                      <NavListLink current={title === current} asChild>
                        <button type="button" onClick={() => setCurrent(title)}>
                          <Icon />
                          {title}
                        </button>
                      </NavListLink>
                    </NavListItem>
                  ))}
                </NavList>
              </nav>
            </NavListFrame>
          </aside>
        </Pane>
        <div className="flex min-w-0 flex-1 flex-col">
          <Pane
            purpose="toolbar"
            edge="bottom"
            className="flex shrink-0 items-center gap-0.5 px-1.5 py-1.5"
          >
            <ToolbarButton size="sm">
              <ReplyIcon />
              Reply
            </ToolbarButton>
            <ToolbarSeparator />
            <ToolbarButton aria-label="Archive">
              <ArchiveIcon />
            </ToolbarButton>
            <ToolbarButton aria-label="Delete">
              <Trash2Icon />
            </ToolbarButton>
            <ToolbarButton aria-label="Mark as unread">
              <MailIcon />
            </ToolbarButton>
          </Pane>
          <Pane purpose="document" className="flex min-h-0 flex-1 flex-col">
            <article className="min-h-0 flex-1 overflow-y-auto p-4 text-ui">
              <h2 className="font-medium">{THREAD?.subject}</h2>
              <p className="text-muted-foreground text-ui-sm">
                {INBOX_PEOPLE[THREAD?.messages[0]?.from ?? ""]}
              </p>
              <Markdown className="mt-3">
                {THREAD?.messages[0]?.body ?? ""}
              </Markdown>
            </article>
          </Pane>
          <Pane
            purpose="statusbar"
            className="flex shrink-0 items-center px-3 py-1.5"
          >
            {current}: 1 of 3 unread
          </Pane>
        </div>
      </Pane>
    );
  },
};

/**
 * A window of the app's own over the rest, with its `titlebar`; under Raymond the caption greys
 * while the focus is elsewhere on the page.
 */
export const Window: Story = {
  args: {
    purpose: "window",
    className: "flex w-80 flex-col overflow-hidden",
  },
  render: (args) => (
    <Pane {...args}>
      <Pane purpose="titlebar" asChild>
        <header className="flex shrink-0 items-center gap-1 py-1 pr-1 pl-3">
          <h2 className="min-w-0 flex-1 truncate">New message</h2>
          <Button variant="ghost" size="icon-sm" aria-label="Minimise">
            <MinusIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Close">
            <XIcon />
          </Button>
        </header>
      </Pane>
      <Pane purpose="document" className="flex h-32 flex-col">
        <p className="min-h-0 flex-1 overflow-y-auto p-3 text-ui">
          Thanks for the review. I have pushed the fixes; could you take another
          look before Friday?
        </p>
      </Pane>
      <Pane purpose="panel" edge="top" className="flex p-2">
        <Button>
          <SendIcon />
          Send
        </Button>
      </Pane>
    </Pane>
  ),
};
