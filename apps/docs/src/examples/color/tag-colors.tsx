import { TASK_LABEL_COLORS, TASK_LABELS } from "@orz/fixtures/tasks.ts";
import { autoTagColor, Badge } from "@orz/ui/components/badge";

// The same labels as a forge's import might colour them.
const IMPORTED: Readonly<Record<string, string>> = {
  bug: "#d73a4a",
  ci: "#0e8a16",
  docs: "#0075ca",
  design: "#d876e3",
  perf: "#fbca04",
  release: "#5319e7",
};

const ROWS = [
  { how: 'color="red"', colorOf: (label: string) => TASK_LABEL_COLORS[label] },
  { how: "autoTagColor(id)", colorOf: (label: string) => autoTagColor(label) },
  { how: 'color="#d73a4a"', colorOf: (label: string) => IMPORTED[label] },
];

export function TagColors() {
  return (
    <dl className="grid grid-cols-[8.5rem_1fr] items-center gap-x-4 gap-y-3 text-ui">
      {ROWS.map(({ how, colorOf }) => (
        <div key={how} className="contents">
          <dt className="font-mono text-muted-foreground text-ui-sm">{how}</dt>
          <dd className="flex flex-wrap gap-1">
            {TASK_LABELS.map((label) => (
              <Badge key={label} variant="marker" color={colorOf(label)}>
                {label}
              </Badge>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
