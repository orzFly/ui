import {
  TASK_PEOPLE,
  type Task,
  type TaskStatus,
} from "@orz/fixtures/tasks.ts";

export const STATUSES: readonly { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "review", label: "In review" },
  { value: "closed", label: "Closed" },
];

export const statusLabel = (status: TaskStatus) =>
  STATUSES.find((each) => each.value === status)?.label ?? status;

export const isOpen = (task: Task) => task.status !== "closed";

export const taskKey = (id: number) => `T-${id}`;

export const personOf = (login: string) =>
  TASK_PEOPLE.find((person) => person.login === login);

/**
 * What the toolbar narrows the list to. `status` is a group (`open`, `closed`, `any`) or one
 * open stage; `assignee` is `anyone`, `nobody` or a login; `label` is `any` or a label.
 */
export interface Filters {
  status: "open" | "closed" | "any" | Exclude<TaskStatus, "closed">;
  assignee: string;
  label: string;
  text: string;
}

export const DEFAULT_FILTERS: Filters = {
  status: "open",
  assignee: "anyone",
  label: "any",
  text: "",
};

export function matches(task: Task, filters: Filters): boolean {
  const { status, assignee, label } = filters;
  if (status === "open" && !isOpen(task)) return false;
  if (status === "closed" && isOpen(task)) return false;
  if (status !== "open" && status !== "closed" && status !== "any") {
    if (task.status !== status) return false;
  }
  if (assignee === "nobody" && task.assignee !== null) return false;
  if (assignee !== "anyone" && assignee !== "nobody") {
    if (task.assignee !== assignee) return false;
  }
  if (label !== "any" && !task.labels.includes(label)) return false;
  const text = filters.text.trim().toLowerCase();
  if (text === "") return true;
  return (
    task.title.toLowerCase().includes(text) ||
    taskKey(task.id).toLowerCase() === text ||
    String(task.id) === text
  );
}

/** How many rows a page brings. */
export const PAGE_SIZE = 20;

/** One page of matches: their ids, where the next starts, and how many match in all. */
export interface Page {
  ids: number[];
  next: number | null;
  total: number;
}

export function searchTasks(
  tasks: readonly Task[],
  filters: Filters,
  offset = 0,
): Page {
  const all = tasks.filter((task) => matches(task, filters));
  const end = offset + PAGE_SIZE;
  return {
    ids: all.slice(offset, end).map((task) => task.id),
    next: end < all.length ? end : null,
    total: all.length,
  };
}

/** How long a page takes to arrive: long enough to see the button say so. */
export const LATENCY_MS = 600;

/** `searchTasks` as a server answers it, after a round trip. */
export function fetchTasks(
  tasks: readonly Task[],
  filters: Filters,
  offset: number,
): Promise<Page> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(searchTasks(tasks, filters, offset)), LATENCY_MS),
  );
}

export type TaskChange = Partial<Pick<Task, "status" | "assignee">>;

/**
 * `patch` applied to every task in `ids`, and the function that takes it back. The undo restores
 * only the fields the patch touched, so whatever else the reader changed meanwhile stays.
 */
export function changeTasks(
  tasks: readonly Task[],
  ids: readonly number[],
  patch: TaskChange,
): [Task[], (later: readonly Task[]) => Task[]] {
  const keys = Object.keys(patch) as (keyof TaskChange)[];
  const before = new Map<number, TaskChange>();
  const now = new Date().toISOString();
  const next = tasks.map((task) => {
    if (!ids.includes(task.id)) return task;
    before.set(
      task.id,
      Object.fromEntries(keys.map((key) => [key, task[key]])) as TaskChange,
    );
    return { ...task, ...patch, updated: now };
  });
  const undo = (later: readonly Task[]) =>
    later.map((task) => {
      const was = before.get(task.id);
      return was ? { ...task, ...was } : task;
    });
  return [next, undo];
}

export const deleteTasks = (tasks: readonly Task[], ids: readonly number[]) =>
  tasks.filter((task) => !ids.includes(task.id));

/** A new task on top of the list, with the next id. */
export function createTask(
  tasks: readonly Task[],
  draft: { title: string; assignee: string | null; label: string | null },
): [Task[], Task] {
  const task: Task = {
    id: Math.max(0, ...tasks.map((each) => each.id)) + 1,
    title: draft.title,
    status: "todo",
    assignee: draft.assignee,
    labels: draft.label ? [draft.label] : [],
    related: [],
    body: "",
    updated: new Date().toISOString(),
  };
  return [[task, ...tasks], task];
}

/** "T-42", or "3 tasks": what a toast or a button names. */
export const tasksNamed = (ids: readonly number[]) =>
  ids.length === 1 ? taskKey(ids[0] ?? 0) : `${ids.length} tasks`;
