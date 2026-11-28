import {
  TASK_LABEL_COLORS,
  TASK_PEOPLE,
  type Task,
  type TaskStatus,
} from "@orz/fixtures/tasks.ts";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import { CopyButton } from "@orz/ui/components/copy-button";
import {
  FilterMenu,
  MatchedText,
  matchText,
} from "@orz/ui/components/filter-menu";
import { GroupHeading } from "@orz/ui/components/group-heading";
import { LinkChip } from "@orz/ui/components/link-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import { Separator } from "@orz/ui/components/separator";
import { Timestamp } from "@orz/ui/components/timestamp";
import { isPlainClick } from "@orz/ui/lib/link";
import {
  CircleCheckIcon,
  CircleDotIcon,
  LinkIcon,
  PlusIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { isOpen, STATUSES, taskKey } from "./board.ts";
import { taskHref } from "./location.ts";
import { IconButton, PersonAvatar, StatusDot } from "./parts.tsx";
import { usePickedFirst } from "./use-picked-first.ts";

/** What the details pane does to its task. */
export interface DetailActions {
  onStatus: (status: TaskStatus) => void;
  onAssign: (login: string | null) => void;
  /** Puts a label on the task, or takes it off. */
  onLabel: (label: string, on: boolean) => void;
  /** Makes a label that did not exist, and puts it on the task. */
  onCreateLabel: (label: string) => void;
  onClose: () => void;
  onReopen: () => void;
  onDelete: () => void;
  /** Show another task's details in place of these. */
  onOpen: (id: number) => void;
}

function Field({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6rem_1fr] items-center gap-2 text-ui">
      {id ? (
        <label htmlFor={id} className="text-muted-foreground">
          {label}
        </label>
      ) : (
        <span className="text-muted-foreground">{label}</span>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface LabelRow {
  id: string;
  label: string;
  action?: boolean;
}

/** The task's labels, each picked on or off at once, and a label made from the query. */
function EditLabels({
  task,
  labels,
  actions,
}: {
  task: Task;
  labels: readonly string[];
  actions: DetailActions;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const name = query.trim();
  const rows: LabelRow[] = usePickedFirst(labels, task.labels, open, query)
    .filter((label) => matchText(label, query))
    .map((label) => ({ id: label, label }));
  const known = labels.some(
    (label) => label.toLowerCase() === name.toLowerCase(),
  );
  if (name !== "" && !known) {
    // Names are trimmed, so no label's id starts with a space.
    rows.push({ id: " create", label: `Create “${name}”`, action: true });
  }
  return (
    <FilterMenu
      selection="multiple"
      selectedIds={task.labels}
      onOpenChange={setOpen}
      query={query}
      onQueryChange={setQuery}
      sections={[{ id: "labels", rows }]}
      onSelect={(row, event) => {
        if (row.action) {
          actions.onCreateLabel(name);
          setQuery("");
        } else {
          actions.onLabel(row.id, event.selected);
        }
      }}
      renderRow={(row, state) =>
        row.action ? (
          <>
            <PlusIcon aria-hidden />
            <span className="truncate">{row.label}</span>
          </>
        ) : (
          <Badge variant="marker" color={TASK_LABEL_COLORS[row.id]}>
            <MatchedText text={row.label} query={state.query} />
          </Badge>
        )
      }
      placeholder="Filter or create…"
      inputLabel="Filter labels"
      listLabel="Labels"
      align="start"
      className="w-56"
    >
      <IconButton label="Edit labels" size="icon-sm">
        <TagIcon />
      </IconButton>
    </FilterMenu>
  );
}

/** Links to other tasks, each a chip in the line of text. */
function TaskLinks({
  title,
  tasks,
  onOpen,
}: {
  title: string;
  tasks: readonly Task[];
  onOpen: (id: number) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <section className="grid gap-2">
      <GroupHeading asChild>
        <h3>{title}</h3>
      </GroupHeading>
      <ul className="grid gap-1.5 text-ui">
        {tasks.map((task) => (
          <li key={task.id}>
            <LinkChip
              boxed
              icon={isOpen(task) ? CircleDotIcon : CircleCheckIcon}
              href={taskHref(task.id)}
              onClick={(event) => {
                if (!isPlainClick(event)) return;
                event.preventDefault();
                onOpen(task.id);
              }}
            >
              {taskKey(task.id)} {task.title}
            </LinkChip>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A task's details: the beside-the-list pane on a wide screen, the body of a sheet on a narrow
 * one. The heading is the caller's, since a sheet titles itself.
 */
export function TaskDetails({
  task,
  tasks,
  labels,
  actions,
}: {
  task: Task;
  /** Every task, to resolve the ones this one links to, and the ones linking here. */
  tasks: readonly Task[];
  /** Every label there is, the ones made in the demo included. */
  labels: readonly string[];
  actions: DetailActions;
}) {
  const related = task.related
    .map((id) => tasks.find((each) => each.id === id))
    .filter((each) => each !== undefined);
  const mentionedBy = tasks.filter((each) => each.related.includes(task.id));
  const fieldId = `task-${task.id}`;
  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        <Field id={`${fieldId}-status`} label="Status">
          <Select
            value={task.status}
            onValueChange={(status) => actions.onStatus(status as TaskStatus)}
          >
            <SelectTrigger id={`${fieldId}-status`} size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(({ value }) => (
                <SelectItem key={value} value={value}>
                  <StatusDot status={value} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={`${fieldId}-assignee`} label="Assignee">
          <Select
            value={task.assignee ?? "nobody"}
            onValueChange={(login) =>
              actions.onAssign(login === "nobody" ? null : login)
            }
          >
            <SelectTrigger
              id={`${fieldId}-assignee`}
              size="sm"
              className="w-40"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nobody">Nobody</SelectItem>
              {TASK_PEOPLE.map(({ login, name }) => (
                <SelectItem key={login} value={login}>
                  <PersonAvatar login={login} />
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Labels">
          <span className="flex flex-wrap items-center gap-1">
            {task.labels.length === 0 ? (
              <span className="text-muted-foreground">None</span>
            ) : (
              task.labels.map((label) => (
                <Badge
                  key={label}
                  variant="marker"
                  color={TASK_LABEL_COLORS[label]}
                >
                  {label}
                </Badge>
              ))
            )}
            <EditLabels task={task} labels={labels} actions={actions} />
          </span>
        </Field>
        <Field label="Updated">
          <Timestamp value={task.updated} />
        </Field>
      </div>
      <section className="grid gap-2 text-ui">
        <GroupHeading asChild>
          <h3>Description</h3>
        </GroupHeading>
        {task.body === "" ? (
          <p className="text-muted-foreground">No description yet.</p>
        ) : (
          task.body
            .split("\n\n")
            .map((paragraph) => <p key={paragraph}>{paragraph}</p>)
        )}
      </section>
      <TaskLinks title="Related" tasks={related} onOpen={actions.onOpen} />
      <TaskLinks
        title="Mentioned by"
        tasks={mentionedBy}
        onOpen={actions.onOpen}
      />
      <div className="grid gap-4">
        <Separator />
        <div className="flex flex-wrap gap-2">
          {isOpen(task) ? (
            <Button variant="outline" onClick={actions.onClose}>
              <CircleCheckIcon />
              Close task
            </Button>
          ) : (
            <Button variant="outline" onClick={actions.onReopen}>
              <CircleDotIcon />
              Reopen task
            </Button>
          )}
          <CopyButton
            text={() => new URL(taskHref(task.id), location.href).href}
            icon={<LinkIcon />}
            copiedLabel="Link copied"
          >
            Copy link
          </CopyButton>
          <Button
            variant="destructive"
            className="ml-auto"
            onClick={actions.onDelete}
          >
            <Trash2Icon />
            Delete…
          </Button>
        </div>
      </div>
    </div>
  );
}
