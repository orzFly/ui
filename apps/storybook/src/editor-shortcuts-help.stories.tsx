import { EditorShortcutsHelp } from "@orz/ui-codemirror/components/editor-shortcuts-help";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * The keyboard button that lists MarkdownEditor's paste and quote keys, for a toolbar beside the
 * editor. Apple platforms read ⌘ ⌥ ⇧, others Ctrl Alt Shift.
 */
const meta = {
  title: "ui-codemirror/EditorShortcutsHelp",
  component: EditorShortcutsHelp,
} satisfies Meta<typeof EditorShortcutsHelp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
