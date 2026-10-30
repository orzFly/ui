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
import { ListChecksIcon } from "lucide-react";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/Primitives/Card",
  component: Card,
  args: { size: "default" },
  argTypes: { size: { control: "inline-radio", options: ["default", "sm"] } },
  decorators: [withWidth("max-w-sm")],
  render: (args) => (
    <Card {...args}>
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

export const Playground: Story = {};

export const Small: Story = { args: { size: "sm" } };

/** The header's marker shows the module's icon; without one it draws ▶. */
export const WithIcon: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader icon={<ListChecksIcon />}>
        <CardTitle>Checks</CardTitle>
        <CardDescription>3 of 4 passed</CardDescription>
      </CardHeader>
      <CardContent>
        Lint, typecheck and build passed; one test failed.
      </CardContent>
    </Card>
  ),
};

export const ContentOnly: Story = {
  render: (args) => (
    <Card {...args}>
      <CardContent>A card with nothing but content.</CardContent>
    </Card>
  ),
};
