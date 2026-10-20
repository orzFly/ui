import { useElementHeight } from "@orz/ui/hooks/use-element-height";
import {
  MD_UP,
  POINTER_FINE,
  SM_UP,
  useMediaQuery,
} from "@orz/ui/hooks/use-media-query";
import { useOverlayScrollbars } from "@orz/ui/hooks/use-overlay-scrollbars";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";

const meta = {
  title: "Hooks",
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
export const UseMediaQuery: Story = {
  render: () => (
    <ul className="grid gap-1">
      <Answer label="SM_UP" query={SM_UP} />
      <Answer label="MD_UP" query={MD_UP} />
      <Answer label="POINTER_FINE" query={POINTER_FINE} />
    </ul>
  ),
};

export const UseElementHeight: Story = {
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

const NO_SIDEWAYS = { overflow: { x: "hidden" } } as const;

export const UseOverlayScrollbars: Story = {
  render: function Render() {
    const { slot, viewport } = useOverlayScrollbars(true, NO_SIDEWAYS);
    return (
      <div ref={slot} className="relative w-64 rounded-lg border">
        <div
          ref={viewport}
          className="flex h-64 flex-col gap-2 overflow-y-auto p-2"
        >
          {Array.from({ length: 30 }, (_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static filler rows
              key={i}
              className="rounded-md bg-muted px-2 py-1"
            >
              Card {i + 1}
            </div>
          ))}
        </div>
      </div>
    );
  },
};
