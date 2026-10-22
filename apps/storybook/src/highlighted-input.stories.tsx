import {
  type CaretPosition,
  HighlightedInput,
} from "@orz/ui/components/highlighted-input";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

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

function Demo({ initial, label }: { initial: string; label: string }) {
  const [value, setValue] = useState(initial);
  const [position, setPosition] = useState<CaretPosition>({ caret: 0 });
  return (
    <div className="grid max-w-sm gap-2">
      <HighlightedInput
        aria-label={label}
        value={value}
        onValueChange={setValue}
        onCaretChange={setPosition}
        render={tags}
      />
      <span className="text-muted-foreground text-sm">
        Caret at {position.caret} of {value.length}
      </span>
    </div>
  );
}

const meta = {
  title: "Primitives/HighlightedInput",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An ordinary input whose text is painted by a function: here, `#tags` in
 * the primary colour. Selection, undo and the caret are the input's own.
 */
export const Plain: Story = {
  render: () => <Demo label="Note" initial="Ship the #release after #review" />,
};

/**
 * Type with a Chinese, Japanese or Korean input method. While a composition
 * is open the input shows its own text, underlined candidate included, and
 * the colours return once it is committed.
 */
export const Composition: Story = {
  render: () => <Demo label="Note" initial="部署 #失败 之后回滚" />,
};

/**
 * Text longer than the box. Move the caret to the end: the coloured layer
 * scrolls with the input and stays clipped inside its padding.
 */
export const LongText: Story = {
  render: () => (
    <Demo
      label="Note"
      initial={`${"A long line that keeps going ".repeat(4)}#until it scrolls and #the tags still line up`}
    />
  ),
};
