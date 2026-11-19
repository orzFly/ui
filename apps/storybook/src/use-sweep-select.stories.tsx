import { Checkbox } from "@orz/ui/components/checkbox";
import { List, ListItem } from "@orz/ui/components/list";
import { SelectionBar } from "@orz/ui/components/selection-bar";
import { useSelection } from "@orz/ui/hooks/use-selection";
import { useSweepSelect } from "@orz/ui/hooks/use-sweep-select";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";

const USAGE = `import { useSelection } from "@orz/ui/hooks/use-selection";
import { useSweepSelect } from "@orz/ui/hooks/use-sweep-select";

function Files({ files }: { files: File[] }) {
  const keys = useMemo(() => files.map((file) => file.id), [files]);
  const selection = useSelection(keys);
  const sweep = useSweepSelect({
    isSelected: selection.isSelected,
    paint: selection.paint,
  });
  return (
    <ul onPointerDownCapture={sweep.onPointerDownCapture}>
      {files.map((file) => (
        // What a sweep paints, and what it starts on.
        <li key={file.id} data-sweep-key={file.id}>
          <Checkbox
            data-sweep-start=""
            checked={selection.isSelected(file.id)}
            onClick={(event) => selection.toggle(file.id, { extend: event.shiftKey })}
          />
          {file.name}
        </li>
      ))}
    </ul>
  );
}`;

const meta = {
  title: "ui/Hooks/useSweepSelect",
  parameters: { guidelines: "/guidelines/patterns/actions-and-buttons/" },
  decorators: [withWidth("max-w-sm")],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Press a box and drag down the column of boxes: every row the pointer crosses is selected.
 * Start on a checked box and the same drag clears them. A press that stays on its box is a
 * click; a drag that starts on a month's name selects its text, as it would anywhere.
 */
export const Usage: Story = {
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
  render: function Render() {
    const selection = useSelection(MONTHS);
    const sweep = useSweepSelect({
      isSelected: selection.isSelected,
      paint: selection.paint,
    });
    return (
      <List purpose="listbox" framed>
        <SelectionBar
          edge="bottom"
          count={selection.selected.length}
          total={MONTHS.length}
          onSelectAll={selection.toggleAll}
          onClear={selection.clear}
          idle={<span className="px-1 font-medium">Months</span>}
        />
        <ul className="p-1" onPointerDownCapture={sweep.onPointerDownCapture}>
          {MONTHS.map((month) => (
            <ListItem
              key={month}
              selected={selection.isSelected(month)}
              data-sweep-key={month}
              asChild
            >
              <li className="flex items-center gap-2 px-2 py-1.5">
                <Checkbox
                  data-sweep-start=""
                  aria-label={`Select ${month}`}
                  checked={selection.isSelected(month)}
                  onClick={(event) =>
                    selection.toggle(month, { extend: event.shiftKey })
                  }
                />
                {month}
              </li>
            </ListItem>
          ))}
        </ul>
      </List>
    );
  },
};
