import { useElementHeight } from "@orz/ui/hooks/use-element-height";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import { withWidth } from "./decorators.tsx";

const USAGE = `import { useElementHeight } from "@orz/ui/hooks/use-element-height";
import { useRef } from "react";

function Layout() {
  const header = useRef<HTMLElement>(null);
  // 56 until the first measurement, and for good if the target is missing.
  const height = useElementHeight(() => header.current, 56);
  return (
    <>
      <header ref={header} className="fixed inset-x-0 top-0">…</header>
      <main style={{ paddingTop: height }}>…</main>
    </>
  );
}`;

const meta = {
  title: "ui/Hooks/useElementHeight",
  decorators: [withWidth("max-w-sm")],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Usage: Story = {
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
  render: function Render() {
    const header = useRef<HTMLDivElement>(null);
    const [rows, setRows] = useState(1);
    const height = useElementHeight(() => header.current, 56);
    return (
      <div className="grid gap-3">
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
