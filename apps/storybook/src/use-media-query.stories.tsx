import {
  MD_UP,
  POINTER_FINE,
  SM_UP,
  useMediaQuery,
} from "@orz/ui/hooks/use-media-query";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Hooks/useMediaQuery",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Answer({ label, query }: { label: string; query: string }) {
  const matches = useMediaQuery(query);
  return (
    <li>
      <code>{label}</code>{" "}
      <code className="text-muted-foreground">{query}</code> →{" "}
      <strong>{String(matches)}</strong>
    </li>
  );
}

/** Resize the preview (the toolbar's viewport menu) to watch these flip. */
export const Breakpoints: Story = {
  render: () => (
    <ul className="grid gap-1">
      <Answer label="SM_UP" query={SM_UP} />
      <Answer label="MD_UP" query={MD_UP} />
      <Answer label="POINTER_FINE" query={POINTER_FINE} />
    </ul>
  ),
};
