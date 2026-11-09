import { FieldDescription, FieldError } from "@orz/ui/components/field";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/Primitives/FieldDescription",
  component: FieldDescription,
  parameters: { guidelines: "/guidelines/patterns/forms/" },
  args: {
    id: "email-hint",
    children: "Where we send receipts. Nobody else sees it.",
  },
  decorators: [withWidth("max-w-sm")],
} satisfies Meta<typeof FieldDescription>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The line under a field, which the field names with `aria-describedby`. */
export const UnderAField: Story = {
  render: (args) => (
    <div className="grid gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input id="email" aria-describedby={args.id} />
      <FieldDescription {...args} />
    </div>
  ),
};

/** `FieldError` says what is wrong and how to put it right, on a field set `aria-invalid`. */
export const WithError: Story = {
  render: (args) => (
    <div className="grid gap-1.5">
      <Label htmlFor="email-wrong">Email</Label>
      <Input
        id="email-wrong"
        defaultValue="alice@example"
        aria-invalid
        aria-describedby={args.id}
      />
      <FieldError {...args} />
    </div>
  ),
  args: {
    id: "email-error",
    children: "Enter an email address, like alice@example.com.",
  },
};
