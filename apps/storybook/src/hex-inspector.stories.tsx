import {
  bytesSource,
  HexInspector,
  type HexSelection,
  HexView,
} from "@orz/ui-hex";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { HexFrame, SAMPLE_PNG } from "./hex-fixtures.tsx";

const PNG = bytesSource(SAMPLE_PNG);

const meta = {
  title: "Hex/HexInspector",
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
    <HexFrame>
      <div className="flex flex-wrap items-start gap-6">
        <HexView
          source={PNG}
          rows={16}
          selection={selection}
          onSelectionChange={setSelection}
        />
        <HexInspector className="w-72" source={PNG} selection={selection} />
      </div>
    </HexFrame>
  );
}

export const WithInspector: Story = {
  render: () => <WithInspectorDemo />,
};
