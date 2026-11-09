import { TASK_LABELS } from "@orz/fixtures/tasks.ts";
import { ColorPickerPopover } from "@orz/ui/components/color-picker";
import { List, ListItem } from "@orz/ui/components/list";
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
    <List purpose="collection" className="max-w-xs">
      <ul>
        {TASK_LABELS.map((label) => (
          <ListItem key={label} asChild>
            <li className="flex min-h-row items-center gap-2 px-3 py-1.5">
              <span className="flex-1 text-ui">{label}</span>
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
          </ListItem>
        ))}
      </ul>
    </List>
  );
}
