import {
  LinkCard,
  LinkCardDescription,
  LinkCardLabel,
  LinkCardTitle,
} from "@orz/ui/components/link-card";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRightIcon } from "lucide-react";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/Primitives/LinkCard",
  component: LinkCard,
  parameters: { guidelines: "/guidelines/patterns/navigation/" },
  args: {
    href: "#mail",
    variant: "card",
    children: (
      <>
        <LinkCardTitle>Mail</LinkCardTitle>
        <LinkCardDescription>
          Narrow the window: the sidebar folds to a rail, and below md one pane
          shows at a time.
        </LinkCardDescription>
      </>
    ),
  },
  argTypes: { variant: { control: "inline-radio", options: ["card", "row"] } },
  decorators: [withWidth("max-w-md")],
} satisfies Meta<typeof LinkCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A label above the title says how the page relates to this one: the next in the section. */
export const Label: Story = {
  args: {
    href: "#density",
    className: "items-end text-right",
    children: (
      <>
        <LinkCardLabel>
          Next <ArrowRightIcon />
        </LinkCardLabel>
        <LinkCardTitle>Density</LinkCardTitle>
      </>
    ),
  },
};

/** `variant="row"`: one ruled line of a list of pages, the description beside the title. */
export const Row: Story = {
  render: (args) => (
    <ul>
      {["Principles", "Color", "Typography"].map((title) => (
        <li key={title}>
          <LinkCard {...args} variant="row" href={`#${title}`}>
            <LinkCardTitle>{title}</LinkCardTitle>
            <LinkCardDescription>
              What the {title} page covers.
            </LinkCardDescription>
          </LinkCard>
        </li>
      ))}
    </ul>
  ),
};
