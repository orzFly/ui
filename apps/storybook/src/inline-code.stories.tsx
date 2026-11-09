import { InlineCode } from "@orz/ui/components/inline-code";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/Primitives/InlineCode",
  component: InlineCode,
  parameters: { guidelines: "/guidelines/foundations/typography/" },
  args: { children: "text-muted-foreground" },
  decorators: [withWidth("max-w-md")],
} satisfies Meta<typeof InlineCode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Inside a sentence it takes the text's size, a step smaller. */
export const InASentence: Story = {
  render: (args) => (
    <p className="text-ui">
      Put a secondary line in <InlineCode {...args} />, never a grey of your
      own.
    </p>
  ),
};
