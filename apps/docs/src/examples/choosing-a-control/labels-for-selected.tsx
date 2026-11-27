import { TASK_LABELS, TASKS } from "@orz/fixtures/tasks.ts";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import {
  FilterMenu,
  MatchedText,
  matchText,
} from "@orz/ui/components/filter-menu";
import { List, ListItem } from "@orz/ui/components/list";
import { ChevronDownIcon, TagIcon } from "lucide-react";
import { useState } from "react";

const SELECTED = [60, 56, 53];

export function LabelsForSelected() {
  const [tasks, setTasks] = useState(() =>
    TASKS.filter((task) => SELECTED.includes(task.id)),
  );
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<readonly string[]>(TASK_LABELS);
  const count = (label: string) =>
    tasks.filter((task) => task.labels.includes(label)).length;
  const selectedIds = TASK_LABELS.filter((l) => count(l) === tasks.length);
  const mixedIds = TASK_LABELS.filter(
    (l) => count(l) > 0 && count(l) < tasks.length,
  );
  // What the tasks have first, sorted as the menu opens and as the query
  // changes, never as a row is picked: no row moves under the pointer.
  const sort = () =>
    setOrder(
      TASK_LABELS.toSorted(
        (a, b) => Number(count(b) > 0) - Number(count(a) > 0),
      ),
    );
  return (
    <div className="grid max-w-md gap-3">
      <FilterMenu
        selection="multiple"
        selectedIds={selectedIds}
        mixedIds={mixedIds}
        query={query}
        onQueryChange={(next) => {
          setQuery(next);
          sort();
        }}
        sections={[
          {
            id: "labels",
            rows: order
              .filter((label) => matchText(label, query))
              .map((label) => ({ id: label })),
          },
        ]}
        onSelect={(row, event) =>
          setTasks((all) =>
            all.map((task) => ({
              ...task,
              labels: event.selected
                ? [...new Set([...task.labels, row.id])]
                : task.labels.filter((label) => label !== row.id),
            })),
          )
        }
        renderRow={(row, state) => (
          <MatchedText text={row.id} query={state.query} />
        )}
        placeholder="Filter labels…"
        inputLabel="Filter labels"
        listLabel="Labels"
        className="w-56"
      >
        <Button variant="outline" className="justify-self-start">
          <TagIcon />
          Labels
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </FilterMenu>
      <List purpose="collection" framed>
        <ul>
          {tasks.map((task) => (
            <ListItem key={task.id} asChild>
              <li className="flex min-h-row flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-ui">
                <span className="text-muted-foreground">T-{task.id}</span>
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                <span className="flex gap-1">
                  {task.labels.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </span>
              </li>
            </ListItem>
          ))}
        </ul>
      </List>
    </div>
  );
}
