import { TASK_PEOPLE } from "@orz/fixtures/tasks.ts";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import {
  FilterMenu,
  type FilterMenuSection,
  MatchedText,
  matchText,
} from "@orz/ui/components/filter-menu";
import { ToolbarButton } from "@orz/ui/components/toolbar";
import { ChevronDownIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  DEFAULT_FILTERS,
  type Filters,
  labelColor,
  STATUSES,
} from "./board.ts";
import { PersonAvatar } from "./parts.tsx";
import { usePickedFirst } from "./use-picked-first.ts";

interface Choice {
  id: string;
  label: string;
  /** Drawn before the label: an avatar for a person. */
  lead?: ReactNode;
}

const STATUS_SECTIONS: FilterMenuSection<Choice>[] = [
  {
    id: "groups",
    rows: [
      { id: "open", label: "Open" },
      { id: "closed", label: "Closed" },
      { id: "any", label: "Any status" },
    ],
  },
  {
    id: "stages",
    label: "Open, by stage",
    rows: STATUSES.filter(({ value }) => value !== "closed").map(
      ({ value, label }) => ({ id: value, label }),
    ),
  },
];

const ASSIGNEE_SECTIONS: FilterMenuSection<Choice>[] = [
  {
    id: "any",
    rows: [
      { id: "anyone", label: "Anyone" },
      { id: "nobody", label: "Nobody" },
    ],
  },
  {
    id: "people",
    label: "People",
    rows: TASK_PEOPLE.map(({ login, name }) => ({
      id: login,
      label: name,
      lead: <PersonAvatar login={login} />,
    })),
  },
];

/** A toolbar button naming the filter and its value, which opens a menu that can be searched. */
function Filter({
  name,
  sections,
  value,
  fallback,
  onChange,
}: {
  name: string;
  sections: FilterMenuSection<Choice>[];
  value: string;
  /** The value it holds unless asked otherwise. */
  fallback: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = sections.map((section) => ({
    ...section,
    rows: section.rows.filter((row) => matchText(row.label, query)),
  }));
  const label =
    sections.flatMap((section) => section.rows).find((row) => row.id === value)
      ?.label ?? value;
  return (
    <FilterMenu
      query={query}
      onQueryChange={setQuery}
      sections={shown}
      selectedId={value}
      onSelect={(row) => onChange(row.id)}
      renderRow={(row, state) => (
        <span className="flex min-w-0 items-center gap-2">
          {row.lead}
          <MatchedText text={row.label} query={state.query} />
        </span>
      )}
      placeholder={`Filter ${name.toLowerCase()}…`}
      inputLabel={`Filter ${name.toLowerCase()}`}
      listLabel={name}
      align="start"
      className="w-56"
      toolbarLabel={name}
      toolbarValue={label}
      toolbarActive={value !== fallback}
    >
      <Button variant="outline" size="sm" className="shrink-0">
        <span className="text-muted-foreground">{name}:</span>
        {label}
        <ChevronDownIcon className="text-muted-foreground" />
      </Button>
    </FilterMenu>
  );
}

/** The Label filter: any number of labels, a task listed only when it carries all of them. */
function LabelFilter({
  labels,
  value,
  onChange,
}: {
  /** Every label there is. */
  labels: readonly string[];
  value: readonly string[];
  onChange: (value: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rows = usePickedFirst(labels, value, open, query)
    .filter((label) => matchText(label, query))
    .map((label) => ({ id: label, label }));
  const shown =
    labels.filter((label) => value.includes(label)).join(", ") || "Any label";
  return (
    <FilterMenu
      selection="multiple"
      selectedIds={value}
      onOpenChange={setOpen}
      query={query}
      onQueryChange={setQuery}
      sections={[{ id: "labels", rows }]}
      onSelect={(row, event) =>
        onChange(
          event.selected
            ? [...value, row.id]
            : value.filter((label) => label !== row.id),
        )
      }
      renderRow={(row, state) => (
        <Badge variant="marker" color={labelColor(row.id)}>
          <MatchedText text={row.label} query={state.query} />
        </Badge>
      )}
      placeholder="Filter labels…"
      inputLabel="Filter labels"
      listLabel="Label"
      align="start"
      className="w-56"
      toolbarLabel="Label"
      toolbarValue={shown}
      toolbarActive={value.length > 0}
    >
      <Button variant="outline" size="sm" className="max-w-60 shrink-0">
        <span className="text-muted-foreground">Label:</span>
        <span className="truncate">{shown}</span>
        <ChevronDownIcon className="text-muted-foreground" />
      </Button>
    </FilterMenu>
  );
}

export function FilterBar({
  filters,
  labels,
  onChange,
}: {
  filters: Filters;
  /** Every label there is, the ones made in the demo included. */
  labels: readonly string[];
  onChange: (next: Partial<Filters>) => void;
}) {
  const changed =
    filters.status !== DEFAULT_FILTERS.status ||
    filters.assignee !== DEFAULT_FILTERS.assignee ||
    filters.labels.length > 0;
  return (
    <>
      <Filter
        name="Status"
        sections={STATUS_SECTIONS}
        value={filters.status}
        fallback={DEFAULT_FILTERS.status}
        onChange={(status) => onChange({ status: status as Filters["status"] })}
      />
      <Filter
        name="Assignee"
        sections={ASSIGNEE_SECTIONS}
        value={filters.assignee}
        fallback={DEFAULT_FILTERS.assignee}
        onChange={(assignee) => onChange({ assignee })}
      />
      <LabelFilter
        labels={labels}
        value={filters.labels}
        onChange={(next) => onChange({ labels: next })}
      />
      {changed && (
        <ToolbarButton
          onClick={() =>
            onChange({
              status: DEFAULT_FILTERS.status,
              assignee: DEFAULT_FILTERS.assignee,
              labels: DEFAULT_FILTERS.labels,
            })
          }
        >
          Reset
        </ToolbarButton>
      )}
    </>
  );
}
