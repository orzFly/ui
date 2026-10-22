import {
  ColorPicker,
  ColorPickerPopover,
} from "@orz/ui/components/color-picker";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";

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

const meta = {
  title: "Patterns/ColorPicker",
  component: ColorPicker,
  args: { value: "oklch(0.623 0.214 259.815)" },
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function Live(props: ComponentProps<typeof ColorPicker>) {
  const [value, setValue] = useState(props.value);
  const [commits, setCommits] = useState(0);
  return (
    <div className="grid w-fit gap-2">
      <div className="font-mono text-xs text-muted-foreground">
        value = {value}
        <br />
        commits = {commits}
      </div>
      <div className="rounded-lg border bg-popover p-2 shadow-sm">
        <ColorPicker
          {...props}
          value={value}
          onValueChange={setValue}
          onValueCommit={() => setCommits((n) => n + 1)}
        />
      </div>
    </div>
  );
}

/** An oklch theme token against a white background. */
export const Panel: Story = {
  args: { contrastWith: "oklch(1 0 0)" },
  render: (args) => <Live {...args} />,
};

const SURFACES = ["oklch", "absolute", "hsv"] as const;

/** The three surfaces side by side on one value; `gamut` bounds the oklch one. */
export const Surfaces: Story = {
  args: { value: "oklch(0.7 0.1 25)", gamut: "srgb" },
  argTypes: { gamut: { control: "inline-radio", options: ["srgb", "p3"] } },
  render: (args) => (
    <div className="flex flex-wrap gap-3">
      {SURFACES.map((s) => (
        <Live key={s} {...args} surfaces={[s]} />
      ))}
    </div>
  ),
};

/** Every surface at four hues, for checking the painting. */
export const SurfacesByHue: Story = {
  args: { gamut: "srgb" },
  argTypes: { gamut: { control: "inline-radio", options: ["srgb", "p3"] } },
  render: (args) => (
    <div className="grid gap-3">
      {[25, 110, 145, 265].map((hue) => (
        <div key={hue} className="flex flex-wrap gap-3">
          {SURFACES.map((s) => (
            <Live
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

function ExtraDemo(props: ComponentProps<typeof ColorPicker>) {
  const [blur, setBlur] = useState(8);
  return (
    <Live
      {...props}
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
}

/** A consumer's own control in `extra`, under the swatches. */
export const Extra: Story = {
  args: { value: "oklch(0.7 0.15 300)" },
  render: (args) => <ExtraDemo {...args} />,
};

/** A todou label colour: hex out, no alpha, the presets as swatches. */
export const Hex: Story = {
  args: { value: "#3b82f6", format: "hex", alpha: false, swatches: PRESETS },
  render: (args) => <Live {...args} />,
};

/** A dark theme's border token; the hue survives dragging chroma to 0 and back. */
export const Translucent: Story = {
  args: { value: "oklch(1 0 0 / 10%)" },
  render: (args) => <Live {...args} />,
};

function PopoverDemo() {
  const [label, setLabel] = useState("#3b82f6");
  const [dot, setDot] = useState("#22c55e");
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-4">
      <ColorPickerPopover
        value={label}
        onValueChange={setLabel}
        format="hex"
        alpha={false}
        swatches={PRESETS}
      />
      <ColorPickerPopover
        value={dot}
        onValueChange={setDot}
        format="hex"
        alpha={false}
        swatches={PRESETS}
        surfaces={["hsv"]}
        open={open}
        onOpenChange={setOpen}
        // Closes on a pick, as todou's status colour does.
        onValueCommit={() => setOpen(false)}
        aria-label="Status colour"
      >
        <button
          type="button"
          className="size-7 rounded-full border border-black/15"
          style={{ background: dot }}
        />
      </ColorPickerPopover>
    </div>
  );
}

/** The default trigger, and a round trigger that closes the popover on commit. */
export const Popover: Story = {
  render: () => <PopoverDemo />,
};

const TOKENS = [
  ["primary", "oklch(0.488 0.243 264.376)", "primary-foreground"],
  ["primary-foreground", "oklch(0.97 0.014 254.604)", "primary"],
  ["destructive", "oklch(0.577 0.245 27.325)", "background"],
  ["border", "oklch(1 0 0 / 10%)", "background"],
  ["background", "oklch(0.145 0 0)", "foreground"],
  ["foreground", "oklch(0.985 0 0)", "background"],
] as const;

function TokenListDemo() {
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
          <ColorPickerPopover
            value={values[name]}
            onValueChange={(v) => setValues((all) => ({ ...all, [name]: v }))}
            format="oklch"
            align="end"
            contrastWith={values[pair]}
            contrastLabel={pair}
            resetValue={original}
            chromaLock={locked}
            onChromaLockChange={setLocked}
            swatches={[{ label: "This theme", colors: Object.values(values) }]}
            aria-label={`Edit ${name}`}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * A theme editor's rows: oklch tokens, each against the token it is read on, with a reset to the
 * token's original value and one chroma lock shared by every row.
 */
export const TokenList: Story = {
  render: () => <TokenListDemo />,
};
