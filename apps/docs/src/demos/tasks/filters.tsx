import {
  TASK_LABEL_COLORS,
  TASK_LABELS,
  TASK_PEOPLE,
} from "@orz/fixtures/tasks.ts";
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
import { DEFAULT_FILTERS, type Filters, STATUSES } from "./board.ts";
import { PersonAvatar } from "./parts.tsx";

interface Choice {
  id: string;
  label: string;
  /** Drawn before the label: an avatar for a person. */
  lead?: ReactNode;
  /** A label's colour: the row draws the label as the table does. */
  color?: string;
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

const LABEL_SECTIONS: FilterMenuSection<Choice>[] = [
  { id: "any", rows: [{ id: "any", label: "Any label" }] },
  {
    id: "labels",
    label: "Labels",
    rows: TASK_LABELS.map((label) => ({
      id: label,
      label,
      color: TASK_LABEL_COLORS[label],
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
          {row.color === undefined ? (
            <MatchedText text={row.label} query={state.query} />
          ) : (
            <Badge variant="marker" color={row.color}>
              <MatchedText text={row.label} query={state.query} />
            </Badge>
          )}
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

export function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (next: Partial<Filters>) => void;
}) {
  const changed =
    filters.status !== DEFAULT_FILTERS.status ||
    filters.assignee !== DEFAULT_FILTERS.assignee ||
    filters.label !== DEFAULT_FILTERS.label;
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
      <Filter
        name="Label"
        sections={LABEL_SECTIONS}
        value={filters.label}
        fallback={DEFAULT_FILTERS.label}
        onChange={(label) => onChange({ label })}
      />
      {changed && (
        <ToolbarButton
          onClick={() =>
            onChange({
              status: DEFAULT_FILTERS.status,
              assignee: DEFAULT_FILTERS.assignee,
              label: DEFAULT_FILTERS.label,
            })
          }
        >
          Reset
        </ToolbarButton>
      )}
    </>
  );
}
