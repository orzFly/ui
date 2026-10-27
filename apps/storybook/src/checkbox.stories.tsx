import { Checkbox } from "@orz/ui/components/checkbox";
import { Label } from "@orz/ui/components/label";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

const meta = {
  title: "ui/Primitives/Checkbox",
  component: Checkbox,
  parameters: { guidelines: "/guidelines/patterns/choosing-a-control/" },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { "aria-label": "Pick" },
};

export const States: Story = {
  render: (args) => (
    <div className="grid gap-3">
      {(
        [
          ["checkbox-off", "Unchecked", {}],
          ["checkbox-on", "Checked", { defaultChecked: true }],
          [
            "checkbox-mixed",
            "Indeterminate",
            { defaultChecked: "indeterminate" },
          ],
          ["checkbox-disabled", "Disabled", { disabled: true }],
          [
            "checkbox-disabled-on",
            "Disabled, checked",
            { disabled: true, defaultChecked: true },
          ],
        ] as const
      ).map(([id, label, props]) => (
        <div key={id} className="flex items-center gap-2">
          <Checkbox {...args} id={id} {...props} />
          <Label htmlFor={id}>{label}</Label>
        </div>
      ))}
    </div>
  ),
};

const SPEEDS = ["10 Mb/s", "100 Mb/s", "1 Gb/s", "10 Gb/s"];

/**
 * A parent over a partly checked list is indeterminate; checking it checks
 * every row, and clearing it clears them.
 */
export const SelectAll: Story = {
  render: function Render(args) {
    const [picked, setPicked] = useState<string[]>(["1 Gb/s"]);
    const all =
      picked.length === SPEEDS.length
        ? true
        : picked.length > 0
          ? "indeterminate"
          : false;
    return (
      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            {...args}
            id="speed-all"
            checked={all}
            onCheckedChange={(checked) =>
              setPicked(checked === true ? SPEEDS : [])
            }
          />
          <Label htmlFor="speed-all">Any link speed</Label>
        </div>
        {SPEEDS.map((speed) => (
          <div key={speed} className="ml-6 flex items-center gap-2">
            <Checkbox
              {...args}
              id={`speed-${speed}`}
              checked={picked.includes(speed)}
              onCheckedChange={(checked) =>
                setPicked((prev) =>
                  checked === true
                    ? SPEEDS.filter((s) => s === speed || prev.includes(s))
                    : prev.filter((s) => s !== speed),
                )
              }
            />
            <Label htmlFor={`speed-${speed}`}>{speed}</Label>
          </div>
        ))}
      </div>
    );
  },
};
