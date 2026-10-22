import { useElementHeight } from "@orz/ui/hooks/use-element-height";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";

const meta = {
  title: "Hooks/useElementHeight",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const GrowingHeader: Story = {
  render: function Render() {
    const header = useRef<HTMLDivElement>(null);
    const [rows, setRows] = useState(1);
    const height = useElementHeight(() => header.current, 56);
    return (
      <div className="grid max-w-sm gap-3">
        <div ref={header} className="grid gap-1 rounded-lg border p-2">
          {Array.from({ length: rows }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
            <div key={i}>Header row {i + 1}</div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border px-2"
            onClick={() => setRows((n) => n + 1)}
          >
            Add a row
          </button>
          <button
            type="button"
            className="rounded-md border px-2"
            onClick={() => setRows((n) => Math.max(1, n - 1))}
          >
            Remove a row
          </button>
          <span>
            Measured: <strong>{height}px</strong>
          </span>
        </div>
      </div>
    );
  },
};
