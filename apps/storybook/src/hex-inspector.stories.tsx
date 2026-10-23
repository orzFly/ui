import {
  bytesSource,
  HexInspector,
  type HexSelection,
  HexView,
} from "@orz/ui-hex";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SAMPLE_PNG } from "./fixtures/hex.ts";

const PNG = bytesSource(SAMPLE_PNG);

const meta = {
  title: "ui-hex/HexInspector",
  component: HexInspector,
  args: { source: PNG, selection: null },
  argTypes: { source: { control: false }, selection: { control: false } },
} satisfies Meta<typeof HexInspector>;

export default meta;
type Story = StoryObj<typeof meta>;

function WithInspectorDemo() {
  const [selection, setSelection] = useState<HexSelection | null>({
    anchor: 0x5,
    focus: 0x25,
    pane: "hex",
  });
  return (
    <div className="flex flex-wrap items-start gap-6">
      <HexView
        source={PNG}
        rows={16}
        selection={selection}
        onSelectionChange={setSelection}
      />
      <HexInspector className="w-72" source={PNG} selection={selection} />
    </div>
  );
}

export const WithInspector: Story = {
  render: () => <WithInspectorDemo />,
};
