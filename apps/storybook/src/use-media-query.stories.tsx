import {
  MD_UP,
  POINTER_FINE,
  SM_UP,
  useMediaQuery,
} from "@orz/ui/hooks/use-media-query";
import type { Meta, StoryObj } from "@storybook/react-vite";

const USAGE = `import { MD_UP, POINTER_FINE, useMediaQuery } from "@orz/ui/hooks/use-media-query";

function Toolbar() {
  const wide = useMediaQuery(MD_UP); // (min-width: 768px), Tailwind's md
  const mouse = useMediaQuery(POINTER_FINE);
  return wide ? <FullToolbar shortcuts={mouse} /> : <CompactToolbar />;
}`;

const meta = {
  title: "ui/Hooks/useMediaQuery",
  parameters: { guidelines: "/guidelines/foundations/layout-and-spacing/" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Resize the preview (the toolbar's viewport menu) to watch these flip. */
export const Usage: Story = {
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
  render: function Render() {
    const sm = useMediaQuery(SM_UP);
    const md = useMediaQuery(MD_UP);
    const fine = useMediaQuery(POINTER_FINE);
    return (
      <ul className="grid gap-1">
        {(
          [
            ["SM_UP", SM_UP, sm],
            ["MD_UP", MD_UP, md],
            ["POINTER_FINE", POINTER_FINE, fine],
          ] as const
        ).map(([label, query, matches]) => (
          <li key={label}>
            <code>{label}</code>{" "}
            <code className="text-muted-foreground">{query}</code> →{" "}
            <strong>{String(matches)}</strong>
          </li>
        ))}
      </ul>
    );
  },
};
