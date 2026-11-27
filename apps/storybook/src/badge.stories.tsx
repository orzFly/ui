import {
  autoTagColor,
  Badge,
  TAG_COLORS,
  type TagColor,
} from "@orz/ui/components/badge";
import { NavList, NavListItem, NavListLink } from "@orz/ui/components/nav-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleDotIcon, TagIcon } from "lucide-react";

const VARIANTS = [
  "default",
  "secondary",
  "destructive",
  "success",
  "warning",
  "outline",
  "marker",
  "ghost",
  "link",
] as const;

const meta = {
  title: "ui/Primitives/Badge",
  component: Badge,
  args: { children: "Badge", variant: "default" },
  argTypes: {
    variant: { control: "select", options: VARIANTS },
    color: {
      control: "select",
      options: [...TAG_COLORS, "#d73a4a"],
      if: { arg: "variant", eq: "marker" },
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: ({ color: _color, ...args }) => (
    <div className="flex flex-wrap gap-2">
      {VARIANTS.map((variant) => (
        <Badge {...args} key={variant} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};

export const WithIcon: Story = {
  render: ({ color: _color, ...args }) => (
    <div className="flex flex-wrap gap-2">
      {VARIANTS.map((variant) => (
        <Badge {...args} key={variant} variant={variant}>
          <CircleDotIcon data-icon="inline-start" />
          {variant}
        </Badge>
      ))}
    </div>
  ),
};

export const AsLink: Story = {
  args: { asChild: true, variant: "outline" },
  render: (args) => (
    <Badge {...args}>
      <a href="#badge">A link styled as a badge</a>
    </Badge>
  ),
};

/** The named tag colours, then a marker with none. */
export const Colors: Story = {
  args: { variant: "marker" },
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      {TAG_COLORS.map((color) => (
        <Badge {...args} key={color} variant="marker" color={color}>
          {color}
        </Badge>
      ))}
      <Badge {...args} variant="marker">
        none
      </Badge>
    </div>
  ),
};

const LABELS = ["bug", "ci", "docs", "design", "perf", "release"];

export const AutoColor: Story = {
  args: { variant: "marker" },
  parameters: {
    docs: {
      source: {
        code: `const labels = ${JSON.stringify(LABELS)};

labels.map((name) => (
  <Badge key={name} variant="marker" color={autoTagColor(name)}>
    {name}
  </Badge>
));`,
      },
    },
  },
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      {LABELS.map((name) => (
        <Badge {...args} key={name} variant="marker" color={autoTagColor(name)}>
          {name}
        </Badge>
      ))}
    </div>
  ),
};

// GitHub's default labels, as an app that stores GitHub's colours passes them.
const GITHUB: Record<string, string> = {
  bug: "#d73a4a",
  documentation: "#0075ca",
  duplicate: "#cfd3d7",
  enhancement: "#a2eeef",
  "good first issue": "#7057ff",
  "help wanted": "#008672",
  invalid: "#e4e669",
  question: "#d876e3",
  wontfix: "#ffffff",
};

export const ColorValue: Story = {
  args: { variant: "marker" },
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      {Object.entries(GITHUB).map(([name, color]) => (
        <Badge {...args} key={name} variant="marker" color={color}>
          {name}
        </Badge>
      ))}
    </div>
  ),
};

const PLACES: { name: string; color?: TagColor }[] = [
  { name: "docs", color: "blue" },
  { name: "release", color: "green" },
  { name: "3" },
];

/**
 * Tags in a current place and in a highlighted option, where raymond fills
 * the row with the highlight: the name and the swatch's edge turn white and
 * the swatch keeps its colour.
 */
export const InHighlightedRow: Story = {
  tags: ["edge", "!autodocs"],
  render: () => (
    <div className="flex items-start gap-6">
      <NavList aria-label="Labels" className="w-48">
        {PLACES.map(({ name, color }, index) => (
          <NavListItem key={name}>
            <NavListLink current={index === 0} href={`#${name}`}>
              <TagIcon />
              <Badge variant="marker" color={color}>
                {name}
              </Badge>
            </NavListLink>
          </NavListItem>
        ))}
      </NavList>
      <Select defaultOpen defaultValue="docs">
        <SelectTrigger aria-label="Label" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PLACES.map(({ name, color }) => (
            <SelectItem key={name} value={name}>
              <Badge variant="marker" color={color}>
                {name}
              </Badge>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ),
};
