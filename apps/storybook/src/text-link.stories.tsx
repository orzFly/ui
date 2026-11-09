import { TextLink } from "@orz/ui/components/text-link";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/Primitives/TextLink",
  component: TextLink,
  parameters: { guidelines: "/guidelines/foundations/typography/" },
  args: { href: "#overlays", children: "Overlays" },
  decorators: [withWidth("max-w-md")],
} satisfies Meta<typeof TextLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Inside a sentence, where it sits in the text's size and the link colour. */
export const InASentence: Story = {
  render: (args) => (
    <p className="text-ui">
      A dialog's footer puts its buttons side by side; <TextLink {...args} />{" "}
      shows one.
    </p>
  ),
};
