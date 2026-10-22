import { Label } from "@orz/ui/components/label";
import { Textarea } from "@orz/ui/components/textarea";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Primitives/Textarea",
  component: Textarea,
  args: { placeholder: "Write a comment…", "aria-label": "Comment" },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
  render: () => (
    <div className="grid max-w-sm gap-4">
      <div className="grid gap-2">
        <Label htmlFor="textarea-grow">Grows with its content</Label>
        <Textarea
          id="textarea-grow"
          defaultValue={"One line\nTwo lines\nThree lines"}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="textarea-invalid">Invalid</Label>
        <Textarea id="textarea-invalid" aria-invalid defaultValue="Too short" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="textarea-disabled">Disabled</Label>
        <Textarea id="textarea-disabled" disabled defaultValue="Read only" />
      </div>
    </div>
  ),
};
