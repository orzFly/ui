import { TASKS, type Task } from "@orz/fixtures/tasks.ts";
import { Button } from "@orz/ui/components/button";
import {
  FilterMenu,
  type FilterMenuSection,
  MatchedText,
  matchText,
} from "@orz/ui/components/filter-menu";
import { Label } from "@orz/ui/components/label";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

interface TaskRow {
  id: string;
  label: string;
}

const row = (task: Task): TaskRow => ({
  id: String(task.id),
  label: `T-${task.id} ${task.title}`,
});

const SECTIONS: FilterMenuSection<TaskRow>[] = [
  {
    id: "open",
    label: "Open",
    rows: TASKS.filter((task) => task.status !== "closed").map(row),
  },
  {
    id: "closed",
    label: "Closed",
    rows: TASKS.filter((task) => task.status === "closed").map(row),
  },
];

export function DuplicateOf() {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string>();
  const shown = SECTIONS.map((section) => ({
    ...section,
    rows: section.rows.filter((r) => matchText(r.label, query)),
  }));
  const label = SECTIONS.flatMap((section) => section.rows).find(
    (r) => r.id === picked,
  )?.label;
  return (
    <div className="grid max-w-md gap-3">
      <Label id="do-duplicate-of">Duplicate of</Label>
      <FilterMenu
        query={query}
        onQueryChange={setQuery}
        sections={shown}
        selectedId={picked}
        onSelect={(r) => setPicked(r.id)}
        renderRow={(r, state) => (
          <span className="truncate">
            <MatchedText text={r.label} query={state.query} />
          </span>
        )}
        placeholder="Filter by title or T-number…"
        inputLabel="Filter tasks"
        listLabel="Tasks"
        align="start"
        className="w-80"
      >
        <Button
          variant="outline"
          aria-labelledby="do-duplicate-of"
          className="w-full justify-between"
        >
          <span className="truncate">{label ?? "Pick a task"}</span>
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </FilterMenu>
    </div>
  );
}
