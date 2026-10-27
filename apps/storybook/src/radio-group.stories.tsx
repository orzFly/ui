import { Label } from "@orz/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@orz/ui/components/radio-group";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

const DENSITIES = [
  ["compact", "Compact", "Most rows on screen; smaller text."],
  ["comfortable", "Comfortable", "The default spacing."],
  ["spacious", "Spacious", "Larger rows, easier to tap."],
] as const;

const meta = {
  title: "ui/Primitives/RadioGroup",
  component: RadioGroup,
  parameters: { guidelines: "/guidelines/patterns/choosing-a-control/" },
  args: {
    "aria-label": "Density",
    defaultValue: "comfortable",
    onValueChange: fn(),
  },
  render: (args) => (
    <RadioGroup {...args}>
      {DENSITIES.map(([value, label]) => (
        <div key={value} className="flex items-center gap-2">
          <RadioGroupItem value={value} id={`density-${value}`} />
          <Label htmlFor={`density-${value}`}>{label}</Label>
        </div>
      ))}
    </RadioGroup>
  ),
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A short row of options reads across, with the arrow keys still moving between them. */
export const Horizontal: Story = {
  args: { orientation: "horizontal", className: "flex gap-4" },
  render: (args) => (
    <RadioGroup {...args}>
      {DENSITIES.map(([value, label]) => (
        <div key={value} className="flex items-center gap-2">
          <RadioGroupItem value={value} id={`horizontal-${value}`} />
          <Label htmlFor={`horizontal-${value}`}>{label}</Label>
        </div>
      ))}
    </RadioGroup>
  ),
};

/** A line under each option says what choosing it does. */
export const Descriptions: Story = {
  render: (args) => (
    <RadioGroup {...args}>
      {DENSITIES.map(([value, label, description]) => (
        <div key={value} className="flex items-start gap-2">
          <RadioGroupItem
            value={value}
            id={`described-${value}`}
            aria-describedby={`described-${value}-hint`}
          />
          <div className="grid gap-1">
            <Label htmlFor={`described-${value}`}>{label}</Label>
            <p
              id={`described-${value}-hint`}
              className="text-muted-foreground text-sm"
            >
              {description}
            </p>
          </div>
        </div>
      ))}
    </RadioGroup>
  ),
};

/** One option out of reach, and then the whole group. */
export const Disabled: Story = {
  render: (args) => (
    <div className="flex gap-12">
      {[false, true].map((all) => (
        <RadioGroup {...args} key={String(all)} disabled={all}>
          {DENSITIES.map(([value, label]) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem
                value={value}
                id={`disabled-${all}-${value}`}
                disabled={value === "spacious"}
              />
              <Label htmlFor={`disabled-${all}-${value}`}>{label}</Label>
            </div>
          ))}
        </RadioGroup>
      ))}
    </div>
  ),
};

export const Invalid: Story = {
  args: { defaultValue: undefined },
  render: (args) => (
    <RadioGroup {...args}>
      {DENSITIES.map(([value, label]) => (
        <div key={value} className="flex items-center gap-2">
          <RadioGroupItem value={value} id={`invalid-${value}`} aria-invalid />
          <Label htmlFor={`invalid-${value}`}>{label}</Label>
        </div>
      ))}
    </RadioGroup>
  ),
};
