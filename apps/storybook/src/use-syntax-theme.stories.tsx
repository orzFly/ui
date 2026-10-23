import { useSyntaxTheme } from "@orz/ui-code";
import type { Meta, StoryObj } from "@storybook/react-vite";

const USAGE = `import { useSyntaxTheme } from "@orz/ui-code";

const theme = useSyntaxTheme();
// { light: "github-light", dark: "github-dark" }: the active theme's shiki pair,
// or pierre's own "pierre-light" / "pierre-dark" where a palette names none.
// Stable per pair, so it can go straight into a memoised pierre options object.`;

const meta = {
  title: "ui-code/useSyntaxTheme",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick another theme or mode in the toolbar to watch it change. */
export const Usage: Story = {
  parameters: { docs: { source: { code: USAGE, language: "ts" } } },
  render: function Render() {
    const theme = useSyntaxTheme();
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
        <dt>light</dt>
        <dd>
          <code>{theme.light}</code>
        </dd>
        <dt>dark</dt>
        <dd>
          <code>{theme.dark}</code>
        </dd>
      </dl>
    );
  },
};
