import { TASK_LABELS, TASKS, type Task } from "@orz/fixtures/tasks.ts";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import { Checkbox } from "@orz/ui/components/checkbox";
import {
  FilterMenu,
  MatchedText,
  matchText,
} from "@orz/ui/components/filter-menu";
import { List, ListItem } from "@orz/ui/components/list";
import { ChevronDownIcon, TagIcon } from "lucide-react";
import { useState } from "react";

const SHOWN = [60, 56, 53];

export function LabelsForSelected() {
  const [tasks, setTasks] = useState(() =>
    TASKS.filter((task) => SHOWN.includes(task.id)),
  );
  const [ticked, setTicked] = useState<readonly number[]>(SHOWN);
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<readonly string[]>(TASK_LABELS);
  // The tasks as the menu opened, which a label partly picked goes back to.
  const [opened, setOpened] = useState<readonly Task[]>(tasks);
  const editing = tasks.filter((task) => ticked.includes(task.id));
  const count = (label: string) =>
    editing.filter((task) => task.labels.includes(label)).length;
  const selectedIds = TASK_LABELS.filter((l) => count(l) === editing.length);
  const mixedIds = TASK_LABELS.filter(
    (l) => count(l) > 0 && count(l) < editing.length,
  );
  // What the tasks have first, sorted as the menu opens and as the query
  // changes, never as a row is picked: no row moves under the pointer.
  const sort = () =>
    setOrder(
      TASK_LABELS.toSorted(
        (a, b) => Number(count(b) > 0) - Number(count(a) > 0),
      ),
    );
  const label = (task: Task, name: string, on: boolean) =>
    TASK_LABELS.filter((each) =>
      each === name ? on : task.labels.includes(each),
    );
  return (
    <div className="grid max-w-md gap-3">
      <FilterMenu
        selection="multiple"
        selectedIds={selectedIds}
        mixedIds={mixedIds}
        onOpenChange={(open) => {
          if (open) setOpened(tasks);
        }}
        query={query}
        onQueryChange={(next) => {
          setQuery(next);
          sort();
        }}
        sections={[
          {
            id: "labels",
            rows: order
              .filter((name) => matchText(name, query))
              .map((name) => ({ id: name })),
          },
        ]}
        onSelect={(row, event) =>
          setTasks((all) =>
            all.map((task) => {
              if (!ticked.includes(task.id)) return task;
              const was = opened.find((each) => each.id === task.id);
              const on = event.mixed
                ? (was?.labels.includes(row.id) ?? false)
                : event.selected;
              return { ...task, labels: label(task, row.id, on) };
            }),
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
        <Button
          variant="outline"
          className="justify-self-start"
          disabled={editing.length === 0}
        >
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
                <Checkbox
                  aria-label={`T-${task.id}`}
                  checked={ticked.includes(task.id)}
                  onCheckedChange={(on) =>
                    setTicked((ids) =>
                      on === true
                        ? [...ids, task.id]
                        : ids.filter((id) => id !== task.id),
                    )
                  }
                />
                <span className="text-muted-foreground">T-{task.id}</span>
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                <span className="flex gap-1">
                  {TASK_LABELS.filter((name) => task.labels.includes(name)).map(
                    (name) => (
                      <Badge key={name} variant="outline">
                        {name}
                      </Badge>
                    ),
                  )}
                </span>
              </li>
            </ListItem>
          ))}
        </ul>
      </List>
    </div>
  );
}
