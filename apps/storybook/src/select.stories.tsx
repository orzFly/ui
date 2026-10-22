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

const meta = {
  title: "Primitives/Select",
  component: Select,
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

function Fruit({
  size,
  position,
}: {
  size: "sm" | "default";
  position?: "item-aligned" | "popper";
}) {
  return (
    <Select defaultValue="pear">
      <SelectTrigger size={size} aria-label={`Fruit (${size})`}>
        <SelectValue placeholder="Pick a fruit" />
      </SelectTrigger>
      <SelectContent position={position}>
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
      </SelectContent>
    </Select>
  );
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Fruit size="default" />
      <Fruit size="sm" />
    </div>
  ),
};

export const Popper: Story = {
  render: () => <Fruit size="default" position="popper" />,
};

export const Placeholder: Story = {
  render: () => (
    <Select>
      <SelectTrigger aria-label="Status">
        <SelectValue placeholder="Pick a status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="open">Open</SelectItem>
        <SelectItem value="closed">Closed</SelectItem>
      </SelectContent>
    </Select>
  ),
};
