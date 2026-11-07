import {
  NavList,
  NavListCount,
  NavListHeading,
  NavListItem,
  NavListLink,
} from "@orz/ui/components/nav-list";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ArchiveIcon,
  FileTextIcon,
  InboxIcon,
  SendIcon,
  StarIcon,
  TagIcon,
} from "lucide-react";
import { useState } from "react";
import { withWidth } from "./decorators.tsx";

const FOLDERS = [
  { title: "Inbox", Icon: InboxIcon, count: 8 },
  { title: "Starred", Icon: StarIcon, count: 0 },
  { title: "Sent", Icon: SendIcon, count: 0 },
  { title: "Drafts", Icon: FileTextIcon, count: 1 },
  { title: "Archive", Icon: ArchiveIcon, count: 0 },
];

const LABELS = ["review", "ci", "design", "release"];

const meta = {
  title: "ui/Primitives/NavList",
  component: NavList,
  parameters: { guidelines: "/guidelines/patterns/navigation/" },
  args: { "aria-label": "Folders" },
  decorators: [withWidth("max-w-60")],
  render: function Render(args) {
    const [current, setCurrent] = useState("Inbox");
    return (
      <NavList {...args}>
        {FOLDERS.map(({ title, Icon, count }) => (
          <NavListItem key={title}>
            <NavListLink current={title === current} asChild>
              <button type="button" onClick={() => setCurrent(title)}>
                <Icon />
                {title}
                {count > 0 && <NavListCount>{count}</NavListCount>}
              </button>
            </NavListLink>
          </NavListItem>
        ))}
      </NavList>
    );
  },
} satisfies Meta<typeof NavList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const GROUPS = [
  {
    heading: "Folders",
    places: FOLDERS.map(({ title, Icon }) => ({ title, Icon })),
  },
  {
    heading: "Labels",
    places: LABELS.map((title) => ({ title, Icon: TagIcon })),
  },
];

/** Groups under headings, each an item holding its heading and its own list. */
export const Headings: Story = {
  args: { "aria-label": "Mail" },
  render: function Render(args) {
    const [current, setCurrent] = useState("Inbox");
    return (
      <NavList {...args}>
        {GROUPS.map(({ heading, places }) => (
          <NavListItem key={heading}>
            <NavListHeading asChild>
              <h2>{heading}</h2>
            </NavListHeading>
            <NavList>
              {places.map(({ title, Icon }) => (
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
          </NavListItem>
        ))}
      </NavList>
    );
  },
};

const REGIONS = [
  { id: "signature", label: "Signature", depth: 0 },
  { id: "ihdr", label: "IHDR", depth: 0 },
  { id: "width", label: "Width", depth: 1 },
  { id: "height", label: "Height", depth: 1 },
  { id: "idat", label: "IDAT", depth: 0 },
];

/** Nested places indented by `depth`, the one in view marked `current="location"`. */
export const Nested: Story = {
  args: { "aria-label": "PNG" },
  render: function Render(args) {
    const [current, setCurrent] = useState("width");
    return (
      <NavList {...args}>
        {REGIONS.map(({ id, label, depth }) => (
          <NavListItem key={id}>
            <NavListLink
              current={id === current && "location"}
              depth={depth}
              asChild
            >
              <button type="button" onClick={() => setCurrent(id)}>
                {label}
              </button>
            </NavListLink>
          </NavListItem>
        ))}
      </NavList>
    );
  },
};
