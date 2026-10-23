import { HighlightedInput } from "@orz/ui/components/highlighted-input";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { fn } from "storybook/test";
import { withWidth } from "./decorators.tsx";

/**
 * Colours `#tags` and leaves the rest alone. Every piece is a span of the
 * same characters, colour only: the mirror sits under the input's glyphs.
 */
function tags(text: string) {
  return text.split(/(#[\p{L}\p{N}_-]+)/u).map((piece, i) =>
    piece.startsWith("#") ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: the pieces are positional
      <span key={i} className="text-primary">
        {piece}
      </span>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: the pieces are positional
      <span key={i}>{piece}</span>
    ),
  );
}

const meta = {
  title: "ui/Primitives/HighlightedInput",
  component: HighlightedInput,
  args: {
    "aria-label": "Note",
    value: "Ship the #release after #review",
    render: tags,
    onValueChange: fn(),
    onCaretChange: fn(),
  },
  argTypes: { render: { control: false } },
  decorators: [withWidth("max-w-sm")],
  // The text is the input's own while typing; the control only resets it.
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    useEffect(() => setValue(args.value), [args.value]);
    return (
      <HighlightedInput
        {...args}
        value={value}
        onValueChange={(next) => {
          args.onValueChange(next);
          setValue(next);
        }}
      />
    );
  },
} satisfies Meta<typeof HighlightedInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An ordinary input whose text is painted by a function: here, `#tags` in
 * the primary colour. Selection, undo and the caret are the input's own.
 */
export const Playground: Story = {};

/**
 * Type with a Chinese, Japanese or Korean input method. While a composition
 * is open the input shows its own text, underlined candidate included, and
 * the colours return once it is committed.
 */
export const Composition: Story = {
  args: { value: "部署 #失败 之后回滚" },
};

/**
 * Text longer than the box. Move the caret to the end: the coloured layer
 * scrolls with the input and stays clipped inside its padding.
 */
export const LongText: Story = {
  args: {
    value: `${"A long line that keeps going ".repeat(4)}#until it scrolls and #the tags still line up`,
  },
};
