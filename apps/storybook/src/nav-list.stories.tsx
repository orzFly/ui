import {
  NavList,
  NavListCount,
  NavListFrame,
  NavListGroup,
  NavListGroupContent,
  NavListGroupRow,
  NavListGroupToggle,
  NavListHeading,
  NavListItem,
  NavListLink,
} from "@orz/ui/components/nav-list";
import { isPlainClick } from "@orz/ui/lib/link";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ArchiveIcon,
  FileTextIcon,
  FolderIcon,
  InboxIcon,
  SendIcon,
  StarIcon,
  TagIcon,
} from "lucide-react";
import { Fragment, type MouseEvent, useState } from "react";
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
  argTypes: { variant: { control: "inline-radio", options: ["rows", "rail"] } },
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

/**
 * An app's own column of places in a `NavListFrame`, which a style may draw as a well: switch the
 * toolbar's Style to Raymond to see it. The scroller sits inside the frame.
 */
export const Frame: Story = {
  render: function Render(args) {
    const [current, setCurrent] = useState("Inbox");
    return (
      <NavListFrame className="flex h-56 flex-col">
        <nav
          aria-label={args["aria-label"]}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          {GROUPS.map(({ heading, places }) => (
            <Fragment key={heading}>
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
            </Fragment>
          ))}
        </nav>
      </NavListFrame>
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

const ARCHIVE = ["2026", "2025", "2024"];

/**
 * Groups the reader opens and closes. A group that is a place heads itself with a
 * `NavListGroupRow`: its link goes to the place, the toggle at the row's end opens the group. A
 * group with no page of its own makes its heading the toggle. Until the reader chooses, a group is
 * open exactly while it holds the current place.
 */
export const Groups: Story = {
  args: { "aria-label": "Mail" },
  render: function Render(args) {
    const [current, setCurrent] = useState("Inbox");
    const go = (place: string) => (event: MouseEvent) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      setCurrent(place);
    };
    return (
      <NavList {...args}>
        {FOLDERS.slice(0, 4).map(({ title, Icon, count }) => (
          <NavListItem key={title}>
            <NavListLink
              href={`#${title.toLowerCase()}`}
              current={title === current}
              onClick={go(title)}
            >
              <Icon />
              {title}
              {count > 0 && <NavListCount>{count}</NavListCount>}
            </NavListLink>
          </NavListItem>
        ))}
        <NavListItem>
          <NavListGroup>
            <NavListGroupRow>
              <NavListLink
                href="#archive"
                current={current === "Archive"}
                onClick={go("Archive")}
              >
                <ArchiveIcon />
                Archive
              </NavListLink>
              <NavListGroupToggle />
            </NavListGroupRow>
            <NavListGroupContent>
              <NavList>
                {ARCHIVE.map((year) => (
                  <NavListItem key={year}>
                    <NavListLink
                      href={`#archive-${year}`}
                      depth={1}
                      current={year === current}
                      onClick={go(year)}
                    >
                      <FolderIcon />
                      {year}
                    </NavListLink>
                  </NavListItem>
                ))}
              </NavList>
            </NavListGroupContent>
          </NavListGroup>
        </NavListItem>
        <NavListItem>
          <NavListGroup defaultOpen>
            <NavListHeading asChild>
              <h2>
                <NavListGroupToggle>Labels</NavListGroupToggle>
              </h2>
            </NavListHeading>
            <NavListGroupContent>
              <NavList>
                {LABELS.map((label) => (
                  <NavListItem key={label}>
                    <NavListLink
                      href={`#${label}`}
                      current={label === current}
                      onClick={go(label)}
                    >
                      <TagIcon />
                      {label}
                    </NavListLink>
                  </NavListItem>
                ))}
              </NavList>
            </NavListGroupContent>
          </NavListGroup>
        </NavListItem>
      </NavList>
    );
  },
};

/** Both kinds of group closed over the current place: each head is drawn as current. */
export const ClosedGroupHoldingCurrent: Story = {
  tags: ["edge", "!autodocs"],
  render: (args) => (
    <div className="flex flex-col gap-4">
      <NavList {...args}>
        <NavListItem>
          <NavListGroup defaultOpen={false}>
            <NavListGroupRow>
              <NavListLink href="#archive">
                <ArchiveIcon />
                Archive
              </NavListLink>
              <NavListGroupToggle />
            </NavListGroupRow>
            <NavListGroupContent>
              <NavList>
                {ARCHIVE.map((year) => (
                  <NavListItem key={year}>
                    <NavListLink
                      href={`#archive-${year}`}
                      depth={1}
                      current={year === "2025"}
                    >
                      <FolderIcon />
                      {year}
                    </NavListLink>
                  </NavListItem>
                ))}
              </NavList>
            </NavListGroupContent>
          </NavListGroup>
        </NavListItem>
      </NavList>
      <NavList {...args}>
        <NavListItem>
          <NavListGroup defaultOpen={false}>
            <NavListHeading asChild>
              <h2>
                <NavListGroupToggle>Labels</NavListGroupToggle>
              </h2>
            </NavListHeading>
            <NavListGroupContent>
              <NavList>
                {LABELS.map((label) => (
                  <NavListItem key={label}>
                    <NavListLink href={`#${label}`} current={label === "ci"}>
                      <TagIcon />
                      {label}
                    </NavListLink>
                  </NavListItem>
                ))}
              </NavList>
            </NavListGroupContent>
          </NavListGroup>
        </NavListItem>
      </NavList>
    </div>
  ),
};

/** A head too long for its row cuts off before the toggle, which stays at the row's end. */
export const LongGroupName: Story = {
  tags: ["edge", "!autodocs"],
  decorators: [withWidth("max-w-40")],
  render: (args) => (
    <NavList {...args}>
      <NavListItem>
        <NavListGroup>
          <NavListGroupRow>
            <NavListLink href="#archive">
              <ArchiveIcon />
              <span className="truncate">
                Archived correspondence from earlier years
              </span>
            </NavListLink>
            <NavListGroupToggle />
          </NavListGroupRow>
          <NavListGroupContent>
            <NavList>
              {ARCHIVE.map((year) => (
                <NavListItem key={year}>
                  <NavListLink href={`#archive-${year}`} depth={1}>
                    <FolderIcon />
                    {year}
                  </NavListLink>
                </NavListItem>
              ))}
            </NavList>
          </NavListGroupContent>
        </NavListGroup>
      </NavListItem>
      <NavListItem>
        <NavListGroup defaultOpen>
          <NavListHeading asChild>
            <h2>
              <NavListGroupToggle>
                Labels shared with the whole team
              </NavListGroupToggle>
            </h2>
          </NavListHeading>
          <NavListGroupContent>
            <NavList>
              {LABELS.map((label) => (
                <NavListItem key={label}>
                  <NavListLink href={`#${label}`}>
                    <TagIcon />
                    {label}
                  </NavListLink>
                </NavListItem>
              ))}
            </NavList>
          </NavListGroupContent>
        </NavListGroup>
      </NavListItem>
    </NavList>
  ),
};

const SECTIONS = [
  { id: "spacing", label: "Spacing", depth: 0 },
  { id: "breakpoints", label: "Breakpoints", depth: 0 },
  { id: "phone", label: "On a phone", depth: 1 },
  { id: "width", label: "Width", depth: 0 },
];

/**
 * `variant="rail"`, for the sections of the page in view beside it: quiet lines off a rule, the
 * one in view taking the state cue over it. Its rows take the size of the text around them.
 */
export const Rail: Story = {
  args: { "aria-label": "On this page", variant: "rail" },
  render: function Render(args) {
    const [current, setCurrent] = useState("breakpoints");
    return (
      <NavList {...args}>
        {SECTIONS.map(({ id, label, depth }) => (
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
