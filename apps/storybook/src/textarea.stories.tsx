import { Label } from "@orz/ui/components/label";
import { Textarea } from "@orz/ui/components/textarea";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/Primitives/Textarea",
  component: Textarea,
  decorators: [withWidth("max-w-sm")],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { placeholder: "Write a comment…", "aria-label": "Comment" },
};

export const States: Story = {
  render: (args) => (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="textarea-grow">Grows with its content</Label>
        <Textarea
          {...args}
          id="textarea-grow"
          defaultValue={"One line\nTwo lines\nThree lines"}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="textarea-invalid">Invalid</Label>
        <Textarea
          {...args}
          id="textarea-invalid"
          aria-invalid
          defaultValue="Too short"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="textarea-disabled">Disabled</Label>
        <Textarea
          {...args}
          id="textarea-disabled"
          disabled
          defaultValue="Read only"
        />
      </div>
    </div>
  ),
};
