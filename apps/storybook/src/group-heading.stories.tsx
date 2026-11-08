import { GroupHeading } from "@orz/ui/components/group-heading";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/Primitives/GroupHeading",
  component: GroupHeading,
  parameters: { guidelines: "/guidelines/foundations/styles/" },
  args: { children: "Indent with" },
  decorators: [withWidth("max-w-sm")],
} satisfies Meta<typeof GroupHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The heading element the page's outline needs, here an `h3`. */
export const AsChild: Story = {
  render: (args) => (
    <GroupHeading {...args} asChild>
      <h3>{args.children}</h3>
    </GroupHeading>
  ),
};
