import {
  TASK_PEOPLE,
  type Task,
  type TaskStatus,
} from "@orz/fixtures/tasks.ts";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import { isPlainLeftClick, LinkChip } from "@orz/ui/components/link-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import {
  CircleCheckIcon,
  CircleDotIcon,
  LinkIcon,
  Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";
import { isOpen, STATUSES, taskKey } from "./board.ts";
import { taskHref } from "./location.ts";
import { PersonAvatar, Stamp, StatusDot } from "./parts.tsx";

/** What the details pane does to its task. */
export interface DetailActions {
  onStatus: (status: TaskStatus) => void;
  onAssign: (login: string | null) => void;
  onClose: () => void;
  onReopen: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
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
      <h3 className="font-medium text-muted-foreground text-ui-sm">{title}</h3>
      <ul className="grid gap-1.5 text-ui">
        {tasks.map((task) => (
          <li key={task.id}>
            <LinkChip
              boxed
              icon={isOpen(task) ? CircleDotIcon : CircleCheckIcon}
              href={taskHref(task.id)}
              onClick={(event) => {
                if (!isPlainLeftClick(event)) return;
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
  actions,
}: {
  task: Task;
  /** Every task, to resolve the ones this one links to, and the ones linking here. */
  tasks: readonly Task[];
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
          {task.labels.length === 0 ? (
            <span className="text-muted-foreground">None</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {task.labels.map((label) => (
                <Badge key={label} variant="outline">
                  {label}
                </Badge>
              ))}
            </span>
          )}
        </Field>
        <Field label="Updated">
          <Stamp at={task.updated} />
        </Field>
      </div>
      <section className="grid gap-2 text-ui">
        <h3 className="font-medium text-muted-foreground text-ui-sm">
          Description
        </h3>
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
      <div className="flex flex-wrap gap-2 border-t pt-4">
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
        <Button variant="ghost" onClick={actions.onCopyLink}>
          <LinkIcon />
          Copy link
        </Button>
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
  );
}
