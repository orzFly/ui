import { TASK_LABELS } from "@orz/fixtures/tasks.ts";
import { ColorPickerPopover } from "@orz/ui/components/color-picker";
import { useState } from "react";

const PALETTE = [
  "#6b7280",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export function LabelColours() {
  const [colours, setColours] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      TASK_LABELS.map((label, i) => [
        label,
        PALETTE[(i * 3 + 1) % PALETTE.length] ?? "#6b7280",
      ]),
    ),
  );
  return (
    <ul className="grid max-w-xs divide-y rounded-lg border">
      {TASK_LABELS.map((label) => (
        <li key={label} className="flex items-center gap-2 px-3 py-1.5">
          <span className="flex-1 text-sm">{label}</span>
          <ColorPickerPopover
            value={colours[label] ?? "#6b7280"}
            onValueChange={(value) =>
              setColours((all) => ({ ...all, [label]: value }))
            }
            format="hex"
            alpha={false}
            swatches={PALETTE}
            align="end"
            aria-label={`Colour of ${label}`}
          />
        </li>
      ))}
    </ul>
  );
}
