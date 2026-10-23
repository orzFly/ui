import { bytesSource, HexInspector } from "@orz/ui-hex";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";
import { SAMPLE_PNG } from "./fixtures/hex.ts";

const PNG = bytesSource(SAMPLE_PNG);

const PLAYGROUND = `import { bytesSource, HexInspector } from "@orz/ui-hex";
import "@orz/ui-hex/styles.css";

<HexInspector source={source} selection={{ anchor: 0x5, focus: 0x25, pane: "hex" }} />`;

const BIG_ENDIAN = `<HexInspector source={source} selection={selection} defaultLittleEndian={false} />`;

const meta = {
  title: "ui-hex/HexInspector",
  component: HexInspector,
  // The canvas width, not a prop the snippet should show.
  decorators: [withWidth("w-72")],
  args: {
    source: PNG,
    selection: { anchor: 0x5, focus: 0x25, pane: "hex" },
  },
  argTypes: {
    source: { control: false },
    selection: { control: "object" },
    littleEndian: { control: false },
  },
} satisfies Meta<typeof HexInspector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  parameters: { docs: { source: { code: PLAYGROUND, language: "tsx" } } },
};

export const BigEndian: Story = {
  args: { defaultLittleEndian: false },
  parameters: { docs: { source: { code: BIG_ENDIAN, language: "tsx" } } },
};
