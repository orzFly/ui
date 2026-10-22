import { ThemeMenu } from "@orz/ui/components/theme-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Drives the same store as the toolbar's Theme picker, so a pick here changes
 * the whole preview (the toolbar re-applies its own value on the next story).
 */
const meta = {
  title: "Patterns/ThemeMenu",
  component: ThemeMenu,
} satisfies Meta<typeof ThemeMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
