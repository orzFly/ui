import { CodeBlock, FENCE_COLLAPSE_LINES, FenceFrame } from "@orz/ui-code";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";

const COMPOSE = `services:
  web:
    image: nginx:1.27
    ports:
      - "8080:80"
  worker:
    build: ./worker
    depends_on: [web]`;

const LONG = Array.from(
  { length: FENCE_COLLAPSE_LINES * 2 },
  (_, i) => `export const step${i + 1} = ${i + 1};`,
).join("\n");

/**
 * A code block's frame: an edge, Copy, and the block's language in a toolbar that shows on hover,
 * or a header whose filename downloads the block. `codeContent`, `patchContent` and
 * `mermaidContent` put every fence in one; a code view inside leaves the frame and Copy to it.
 */
const meta = {
  title: "ui-code/FenceFrame",
  component: FenceFrame,
  args: {
    text: COMPOSE,
    lang: "yaml",
    children: (
      <CodeBlock
        filename="compose.yaml"
        contents={COMPOSE}
        copy={false}
        bareFallback
      />
    ),
  },
  argTypes: {
    children: { control: false },
    leading: { control: false },
    actions: { control: false },
  },
  decorators: [withWidth("max-w-xl")],
  parameters: { guidelines: "/guidelines/patterns/code-blocks/" },
} satisfies Meta<typeof FenceFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Hover the block, or Tab to Copy, to bring the toolbar up; without hover it keeps a row. */
export const Playground: Story = {};

/** A block that names a file is headed by it, and the name downloads the block. */
export const Title: Story = { args: { title: "compose.yaml" } };

/** A long block scrolls inside the frame until Expand lifts the cap. */
export const Collapsible: Story = {
  args: {
    text: LONG,
    lang: "ts",
    collapsible: true,
    children: (
      <CodeBlock
        filename="steps.ts"
        contents={LONG}
        copy={false}
        bareFallback
      />
    ),
  },
};

/** A toolbar that is the only way to something, as a diagram's way to its source, never hides. */
export const ToolbarAlwaysVisible: Story = {
  args: { toolbarAlwaysVisible: true },
};
