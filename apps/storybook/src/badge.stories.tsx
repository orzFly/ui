import { Badge } from "@orz/ui/components/badge";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleDotIcon } from "lucide-react";

const VARIANTS = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
] as const;

const meta = {
  title: "Primitives/Badge",
  component: Badge,
  args: { children: "Badge", variant: "default" },
  argTypes: { variant: { control: "select", options: VARIANTS } },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {VARIANTS.map((variant) => (
        <Badge key={variant} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {VARIANTS.map((variant) => (
        <Badge key={variant} variant={variant}>
          <CircleDotIcon data-icon="inline-start" />
          {variant}
        </Badge>
      ))}
    </div>
  ),
};

export const AsLink: Story = {
  render: () => (
    <Badge asChild variant="outline">
      <a href="#badge">A link styled as a badge</a>
    </Badge>
  ),
};
