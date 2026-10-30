import { Button } from "@orz/ui/components/button";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRightIcon, PlusIcon } from "lucide-react";

const VARIANTS = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const;
const TEXT_SIZES = ["xs", "sm", "default", "lg"] as const;
const ICON_SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;

// Docgen prints the props' type as written, VariantProps<…>["variant"].
const union = (values: readonly string[]) => ({
  type: { summary: values.map((v) => `"${v}"`).join(" | ") },
});

const meta = {
  title: "ui/Primitives/Button",
  component: Button,
  parameters: { guidelines: "/guidelines/patterns/actions-and-buttons/" },
  args: { children: "Button" },
  argTypes: {
    variant: { control: "select", options: VARIANTS, table: union(VARIANTS) },
    size: {
      control: "select",
      options: [...TEXT_SIZES, ...ICON_SIZES],
      table: union([...TEXT_SIZES, ...ICON_SIZES]),
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      {VARIANTS.map((variant) => (
        <Button {...args} key={variant} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {VARIANTS.map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-2">
          {TEXT_SIZES.map((size) => (
            <Button {...args} key={size} variant={variant} size={size}>
              {size}
            </Button>
          ))}
          {ICON_SIZES.map((size) => (
            <Button
              {...args}
              key={size}
              variant={variant}
              size={size}
              aria-label={`Add (${size})`}
            >
              <PlusIcon />
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
};

export const WithIcon: Story = {
  render: (args) => (
    <div className="flex gap-2">
      <Button {...args}>
        <PlusIcon data-icon="inline-start" /> New
      </Button>
      <Button {...args} variant="outline">
        Next <ArrowRightIcon data-icon="inline-end" />
      </Button>
      <Button {...args} disabled>
        Disabled
      </Button>
    </div>
  ),
};
