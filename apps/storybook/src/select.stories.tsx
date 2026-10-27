import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

const FRUIT_ITEMS = (
  <>
    <SelectGroup>
      <SelectLabel>Fruit</SelectLabel>
      <SelectItem value="apple">Apple</SelectItem>
      <SelectItem value="pear">Pear</SelectItem>
      <SelectItem value="plum" disabled>
        Plum (out of season)
      </SelectItem>
    </SelectGroup>
    <SelectSeparator />
    <SelectGroup>
      <SelectLabel>Other</SelectLabel>
      <SelectItem value="nut">Nut</SelectItem>
    </SelectGroup>
  </>
);

const meta = {
  title: "ui/Primitives/Select",
  component: Select,
  parameters: { guidelines: "/guidelines/patterns/choosing-a-control/" },
  args: { onValueChange: fn() },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger aria-label="Fruit">
        <SelectValue placeholder="Pick a fruit" />
      </SelectTrigger>
      <SelectContent>{FRUIT_ITEMS}</SelectContent>
    </Select>
  ),
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { defaultValue: "pear" },
};

export const Sizes: Story = {
  args: { defaultValue: "pear" },
  render: (args) => (
    <div className="flex items-center gap-3">
      {(["default", "sm"] as const).map((size) => (
        <Select {...args} key={size}>
          <SelectTrigger size={size} aria-label={`Fruit (${size})`}>
            <SelectValue placeholder="Pick a fruit" />
          </SelectTrigger>
          <SelectContent>{FRUIT_ITEMS}</SelectContent>
        </Select>
      ))}
    </div>
  ),
};

export const Popper: Story = {
  args: { defaultValue: "pear" },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger aria-label="Fruit">
        <SelectValue placeholder="Pick a fruit" />
      </SelectTrigger>
      <SelectContent position="popper">{FRUIT_ITEMS}</SelectContent>
    </Select>
  ),
};

export const Placeholder: Story = {};
