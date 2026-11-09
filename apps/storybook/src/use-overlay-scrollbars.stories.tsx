import { Card, CardContent } from "@orz/ui/components/card";
import { Pane } from "@orz/ui/components/pane";
import { useOverlayScrollbars } from "@orz/ui/hooks/use-overlay-scrollbars";
import type { Meta, StoryObj } from "@storybook/react-vite";

const USAGE = `import "overlayscrollbars/overlayscrollbars.css";
import { useOverlayScrollbars } from "@orz/ui/hooks/use-overlay-scrollbars";

const NO_SIDEWAYS = { overflow: { x: "hidden" } } as const;

function List({ items }: { items: string[] }) {
  const { slot, viewport } = useOverlayScrollbars(true, NO_SIDEWAYS);
  return (
    <div ref={slot} className="relative">
      <div ref={viewport} className="h-64 overflow-y-auto">
        {items.map((item) => <div key={item}>{item}</div>)}
      </div>
    </div>
  );
}`;

const meta = {
  title: "ui/Hooks/useOverlayScrollbars",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const NO_SIDEWAYS = { overflow: { x: "hidden" } } as const;

export const Usage: Story = {
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
  render: function Render() {
    const { slot, viewport } = useOverlayScrollbars(true, NO_SIDEWAYS);
    return (
      <Pane ref={slot} purpose="panel" frame="card" className="relative w-64">
        <div
          ref={viewport}
          className="flex h-64 flex-col gap-2 overflow-y-auto p-2"
        >
          {Array.from({ length: 30 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static filler rows
            <Card key={i} size="sm">
              <CardContent>Card {i + 1}</CardContent>
            </Card>
          ))}
        </div>
      </Pane>
    );
  },
};
