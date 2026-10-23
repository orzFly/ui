import { Label } from "@orz/ui/components/label";
import { Slider } from "@orz/ui/components/slider";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

const meta = {
  title: "ui/Primitives/Slider",
  component: Slider,
  args: { "aria-label": "Volume", defaultValue: [40], className: "w-64" },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

function SteppedSlider() {
  const [value, setValue] = useState([2]);
  return (
    <div className="grid w-64 gap-3">
      <Label htmlFor="slider-stepped">Speed: {value[0]}×</Label>
      <Slider
        id="slider-stepped"
        aria-label="Speed"
        min={0.5}
        max={4}
        step={0.5}
        value={value}
        onValueChange={setValue}
      />
    </div>
  );
}

export const Stepped: Story = { render: () => <SteppedSlider /> };

export const Disabled: Story = { args: { disabled: true } };
