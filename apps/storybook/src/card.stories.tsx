import { Button } from "@orz/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@orz/ui/components/card";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Primitives/Card",
  component: Card,
  args: { size: "default" },
  argTypes: { size: { control: "inline-radio", options: ["default", "sm"] } },
  render: (args) => (
    <Card {...args} className="max-w-sm">
      <CardHeader>
        <CardTitle>Release notes</CardTitle>
        <CardDescription>What changed in this version.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        The theme store now takes its storage key from the app.
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" size="sm">
          Dismiss
        </Button>
        <Button size="sm">Read more</Button>
      </CardFooter>
    </Card>
  ),
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = { args: { size: "sm" } };

export const ContentOnly: Story = {
  render: (args) => (
    <Card {...args} className="max-w-sm">
      <CardContent>A card with nothing but content.</CardContent>
    </Card>
  ),
};
