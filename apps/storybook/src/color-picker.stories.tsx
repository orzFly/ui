import {
  ColorPicker,
  ColorPickerPopover as ColorPickerPopoverView,
} from "@orz/ui/components/color-picker";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { fn } from "storybook/test";

/** todou's status and label presets. */
const PRESETS = [
  "#6b7280",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#0ea5e9",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

// Per story rather than on the meta: the popover stories bring their own.
const panel: Decorator = (Story) => (
  <div className="w-fit rounded-lg border bg-popover p-2 shadow-sm">
    <Story />
  </div>
);

const meta = {
  title: "ui/ColorPicker",
  parameters: { guidelines: "/guidelines/patterns/choosing-a-control/" },
  component: ColorPicker,
  args: {
    value: "oklch(0.623 0.214 259.815)",
    onValueChange: fn(),
    onValueCommit: fn(),
  },
  // The value lives in state, not in the args: a late `updateArgs` would
  // hand the picker a stale value mid-drag and reset it. The effect still
  // lets the `value` control drive it.
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    useEffect(() => setValue(args.value), [args.value]);
    return (
      <ColorPicker
        {...args}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          args.onValueChange?.(next);
        }}
      />
    );
  },
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An oklch theme token against a white background. */
export const Playground: Story = {
  args: { contrastWith: "oklch(1 0 0)" },
  decorators: [panel],
};

const SURFACES = ["oklch", "absolute", "hsv"] as const;

/** The three surfaces side by side on one value; `gamut` bounds the oklch one. */
export const Surfaces: Story = {
  args: { value: "oklch(0.7 0.1 25)", gamut: "srgb" },
  argTypes: { gamut: { control: "inline-radio", options: ["srgb", "p3"] } },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    useEffect(() => setValue(args.value), [args.value]);
    return (
      <div className="flex flex-wrap gap-3">
        {SURFACES.map((s) => (
          <ColorPicker
            key={s}
            {...args}
            value={value}
            onValueChange={(next) => {
              setValue(next);
              args.onValueChange?.(next);
            }}
            surfaces={[s]}
          />
        ))}
      </div>
    );
  },
};

/** Every surface at four hues, for checking the painting. */
export const SurfacesByHue: Story = {
  tags: ["edge", "!autodocs"],
  args: { gamut: "srgb" },
  argTypes: { gamut: { control: "inline-radio", options: ["srgb", "p3"] } },
  decorators: [panel],
  render: (args) => (
    <div className="grid gap-3">
      {[25, 110, 145, 265].map((hue) => (
        <div key={hue} className="flex flex-wrap gap-3">
          {SURFACES.map((s) => (
            <ColorPicker
              key={s}
              {...args}
              value={`oklch(0.7 0.1 ${hue})`}
              surfaces={[s]}
            />
          ))}
        </div>
      ))}
    </div>
  ),
};

/** A consumer's own control in `extra`, under the swatches. */
export const Extra: Story = {
  args: { value: "oklch(0.7 0.15 300)" },
  decorators: [panel],
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    useEffect(() => setValue(args.value), [args.value]);
    const [blur, setBlur] = useState(8);
    return (
      <ColorPicker
        {...args}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          args.onValueChange?.(next);
        }}
        extra={
          <label className="flex items-center gap-2 text-xs">
            Blur
            <input
              type="range"
              min={0}
              max={32}
              value={blur}
              onChange={(event) => setBlur(Number(event.target.value))}
              className="flex-1"
            />
            <span className="w-8 text-right font-mono">{blur}px</span>
          </label>
        }
      />
    );
  },
};

/** A todou label colour: hex out, no alpha, the presets as swatches. */
export const Hex: Story = {
  args: { value: "#3b82f6", format: "hex", alpha: false, swatches: PRESETS },
  decorators: [panel],
};

/** A dark theme's border token; the hue survives dragging chroma to 0 and back. */
export const Translucent: Story = {
  args: { value: "oklch(1 0 0 / 10%)" },
  decorators: [panel],
};

/** The panel in a popover, behind the default trigger, which shows the value. */
export const ColorPickerPopover: Story = {
  args: { value: "#3b82f6", format: "hex", alpha: false, swatches: PRESETS },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    useEffect(() => setValue(args.value), [args.value]);
    return (
      <ColorPickerPopoverView
        {...args}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          args.onValueChange?.(next);
        }}
      />
    );
  },
};

/** A round trigger of the consumer's own, which closes the popover on commit. */
export const CustomTrigger: Story = {
  args: {
    value: "#22c55e",
    format: "hex",
    alpha: false,
    swatches: PRESETS,
    surfaces: ["hsv"],
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    useEffect(() => setValue(args.value), [args.value]);
    const [open, setOpen] = useState(false);
    return (
      <ColorPickerPopoverView
        {...args}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          args.onValueChange?.(next);
        }}
        open={open}
        onOpenChange={setOpen}
        // Closes on a pick, as todou's status colour does.
        onValueCommit={(next) => {
          args.onValueCommit?.(next);
          setOpen(false);
        }}
        aria-label="Status colour"
      >
        <button
          type="button"
          className="size-7 rounded-full border border-black/15"
          style={{ background: value }}
        />
      </ColorPickerPopoverView>
    );
  },
};

const TOKENS = [
  ["primary", "oklch(0.488 0.243 264.376)", "primary-foreground"],
  ["primary-foreground", "oklch(0.97 0.014 254.604)", "primary"],
  ["destructive", "oklch(0.577 0.245 27.325)", "background"],
  ["border", "oklch(1 0 0 / 10%)", "background"],
  ["background", "oklch(0.145 0 0)", "foreground"],
  ["foreground", "oklch(0.985 0 0)", "background"],
] as const;

/**
 * A theme editor's rows: oklch tokens, each against the token it is read on, with a reset to the
 * token's original value and one chroma lock shared by every row.
 */
export const TokenList: Story = {
  // No args on purpose: the snippet then shows the story as written, with the
  // shared lock wired through every row.
  render: function Render() {
    const [values, setValues] = useState<Record<string, string>>(() =>
      Object.fromEntries(TOKENS.map(([name, value]) => [name, value])),
    );
    // One lock for every row, as a theme editor would keep it.
    const [locked, setLocked] = useState(false);
    return (
      <div className="w-96 divide-y rounded-lg border">
        {TOKENS.map(([name, original, pair]) => (
          <div key={name} className="flex items-center gap-2 px-2.5 py-1.5">
            <span className="flex-1 text-sm">{name}</span>
            <ColorPickerPopoverView
              value={values[name]}
              onValueChange={(v) => setValues((all) => ({ ...all, [name]: v }))}
              format="oklch"
              align="end"
              contrastWith={values[pair]}
              contrastLabel={pair}
              resetValue={original}
              chromaLock={locked}
              onChromaLockChange={setLocked}
              swatches={[
                { label: "This theme", colors: Object.values(values) },
              ]}
              aria-label={`Edit ${name}`}
            />
          </div>
        ))}
      </div>
    );
  },
};
