import { TASKS, type Task } from "@orz/fixtures/tasks.ts";
import { Button } from "@orz/ui/components/button";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import { Input } from "@orz/ui/components/input";
import { LoadMoreFooter } from "@orz/ui/components/load-more";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@orz/ui/components/sheet";
import { TooltipProvider } from "@orz/ui/components/tooltip";
import { usePagedAppend } from "@orz/ui/hooks/use-paged-append";
import { ListTodoIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  changeTasks,
  createTask,
  DEFAULT_FILTERS,
  deleteTasks,
  type Filters,
  fetchTasks,
  isOpen,
  matches,
  type Page,
  personOf,
  searchTasks,
  statusLabel,
  type TaskChange,
  taskKey,
  tasksNamed,
} from "./board.ts";
import { type DetailActions, TaskDetails } from "./details.tsx";
import { FilterBar } from "./filters.tsx";
import { closeTask, openTask, taskHref, useOpenTask } from "./location.ts";
import { NewTaskDialog } from "./new-task.tsx";
import { IconButton } from "./parts.tsx";
import { type RowActions, TaskTable } from "./task-table.tsx";

/** Tailwind's `lg`: from here the details sit beside the list, below it they slide over it. */
const WIDE = "(min-width: 1024px)";

function subscribeWide(onChange: () => void) {
  const list = matchMedia(WIDE);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/** Wide on the server, which renders no details either way. */
const useWide = () =>
  useSyncExternalStore(
    subscribeWide,
    () => matchMedia(WIDE).matches,
    () => true,
  );

/** A search as it was run: the filters, and the tasks as they stood then. */
interface Search {
  filters: Filters;
  tasks: readonly Task[];
  /** Counts runs, so the same filters asked again start over. */
  n: number;
}

/**
 * A task list as an app would write one: a table filtered from its toolbar, a menu on each row,
 * a details pane beside the list on a wide screen and a sheet over it on a narrow one, and bulk
 * actions that undo where they can and ask where they cannot.
 *
 * It fills the box it is given: the page lays the box out, the app only fills it.
 */
export function Tasks() {
  const [tasks, setTasks] = useState<readonly Task[]>(TASKS);
  const [search, setSearch] = useState<Search>({
    filters: DEFAULT_FILTERS,
    tasks: TASKS,
    n: 0,
  });
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [deleting, setDeleting] = useState<number[]>([]);
  // Kept apart from `deleting` so the dialog keeps its wording while it fades out.
  const [confirming, setConfirming] = useState(false);
  const [creating, setCreating] = useState(false);
  const openId = useOpenTask();
  const wide = useWide();

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const filters = search.filters;

  const run = (next: Filters) => {
    setSelected(new Set());
    setSearch(({ n }) => ({
      filters: next,
      tasks: tasksRef.current,
      n: n + 1,
    }));
  };
  const filter = (patch: Partial<Filters>) => run({ ...filters, ...patch });

  // Every page is read against the tasks as they were when the search ran, so the next page
  // starts where the last one ended however the list has changed since.
  const first = useMemo(
    () => searchTasks(search.tasks, search.filters),
    [search],
  );
  const paged = usePagedAppend<Page>(String(search.n));
  const pages = [first, ...paged.pages];
  const next = pages.at(-1)?.next ?? null;
  const loaded = pages.reduce((sum, page) => sum + page.ids.length, 0);
  const focusRequested = useRef(false);
  const loadMore = () => {
    if (next === null) return;
    focusRequested.current = true;
    paged.append(() => fetchTasks(search.tasks, search.filters, next));
  };
  // A task that no longer matches leaves the list at once; Undo brings it back to its place.
  const rows = pages
    .flatMap((page) => page.ids)
    .map((id) => tasks.find((task) => task.id === id))
    .filter(
      (task): task is Task => task !== undefined && matches(task, filters),
    );

  const openCounts: Record<string, number> = {};
  for (const task of tasks) {
    if (task.assignee && isOpen(task)) {
      openCounts[task.assignee] = (openCounts[task.assignee] ?? 0) + 1;
    }
  }

  /** Applies `patch`, and says so in a toast whose Undo takes back exactly that. */
  const change = (ids: number[], patch: TaskChange, message: string) => {
    if (ids.length === 0) return;
    const [changed, undo] = changeTasks(tasksRef.current, ids, patch);
    setTasks(changed);
    setSelected(new Set());
    toast(message, {
      action: { label: "Undo", onClick: () => setTasks(undo) },
    });
  };
  const close = (ids: number[]) =>
    change(ids, { status: "closed" }, `Closed ${tasksNamed(ids)}`);
  const reopen = (ids: number[]) =>
    change(ids, { status: "todo" }, `Reopened ${tasksNamed(ids)}`);
  const assign = (id: number, login: string | null) =>
    change(
      [id],
      { assignee: login },
      login === null
        ? `Unassigned ${taskKey(id)}`
        : `Assigned ${taskKey(id)} to ${personOf(login)?.name ?? login}`,
    );
  const copyLink = (id: number) => {
    navigator.clipboard
      ?.writeText(new URL(taskHref(id), location.href).href)
      .then(
        () => toast("Link copied"),
        () => toast.error("Couldn't copy the link"),
      );
  };
  const askDelete = (ids: number[]) => {
    if (ids.length === 0) return;
    setDeleting(ids);
    setConfirming(true);
  };
  const confirmDelete = () => {
    setConfirming(false);
    if (openId !== null && deleting.includes(openId)) closeTask();
    setTasks(deleteTasks(tasksRef.current, deleting));
    setSelected(new Set());
    toast(`Deleted ${tasksNamed(deleting)}`);
  };

  const actions: RowActions = {
    onOpen: openTask,
    onSelect: (id, on) =>
      setSelected((was) => {
        const next = new Set(was);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      }),
    onSelectAll: (on) =>
      setSelected(new Set(on ? rows.map((task) => task.id) : [])),
    onClose: close,
    onReopen: reopen,
    onAssign: assign,
    onCopyLink: copyLink,
    onDelete: askDelete,
    onShowTheirs: (login) => filter({ assignee: login }),
  };

  const task =
    openId === null ? undefined : tasks.find((each) => each.id === openId);
  const detailActions: DetailActions | undefined = task && {
    onStatus: (status) =>
      change(
        [task.id],
        { status },
        `${taskKey(task.id)} is ${statusLabel(status)}`,
      ),
    onAssign: (login) => assign(task.id, login),
    onClose: () => close([task.id]),
    onReopen: () => reopen([task.id]),
    onDelete: () => askDelete([task.id]),
    onCopyLink: () => copyLink(task.id),
    onOpen: openTask,
  };

  const pickedRows = rows.filter((each) => selected.has(each.id));
  const picked = pickedRows.map((each) => each.id);
  const allClosed =
    pickedRows.length > 0 && pickedRows.every((each) => !isOpen(each));
  const pickedName = picked.length === 1 ? "1 task" : `${picked.length} tasks`;

  return (
    <TooltipProvider>
      {/* Capped at a screen, so in a box with no height of its own the table still scrolls. */}
      <div className="flex h-full max-h-dvh min-h-0 overflow-hidden bg-background text-foreground">
        <section
          aria-labelledby="tasks-title"
          className="flex min-w-0 flex-1 flex-col"
        >
          <div className="flex flex-wrap items-center gap-2 border-b px-2 py-2 md:px-4">
            <h2 id="tasks-title" className="mr-2 font-semibold">
              Tasks
            </h2>
            <div className="relative order-last w-full sm:order-none sm:w-56 md:w-64">
              <SearchIcon
                aria-hidden
                className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-4 text-muted-foreground"
              />
              <Input
                type="search"
                aria-label="Search tasks"
                placeholder="Search…"
                value={filters.text}
                onChange={(event) => filter({ text: event.target.value })}
                className="pl-8"
              />
            </div>
            <Button
              size="sm"
              className="ml-auto sm:order-last"
              onClick={() => setCreating(true)}
            >
              <PlusIcon />
              New task…
            </Button>
            {/* One row that scrolls sideways on a phone, rather than three that wrap. */}
            <div className="-mx-2 order-last flex w-[calc(100%+1rem)] gap-2 overflow-x-auto px-2 [scrollbar-width:none] sm:order-none sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
              <FilterBar filters={filters} onChange={filter} />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col *:data-[slot=table-container]:min-h-0 *:data-[slot=table-container]:flex-1 *:data-[slot=table-container]:overflow-auto">
            {rows.length === 0 ? (
              <div className="grid justify-items-center gap-2 px-4 py-12 text-center">
                <ListTodoIcon
                  aria-hidden
                  className="size-8 text-muted-foreground"
                />
                <p className="font-medium">No tasks match</p>
                <p className="text-muted-foreground text-sm">
                  Try another filter, or fewer words.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => run(DEFAULT_FILTERS)}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <TaskTable
                tasks={rows}
                selected={selected}
                openId={openId}
                openCounts={openCounts}
                actions={actions}
                footer={
                  (next !== null || paged.error) && (
                    <div className="grid justify-items-center gap-1">
                      <LoadMoreFooter
                        pending={paged.pending}
                        error={paged.error}
                        onLoadMore={loadMore}
                        focusRequested={focusRequested}
                      />
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {first.total - loaded} more
                      </span>
                    </div>
                  )
                }
              />
            )}
          </div>
          <div className="flex min-h-12 shrink-0 items-center gap-2 border-t px-2 pb-[env(safe-area-inset-bottom)] text-sm md:px-4">
            {picked.length > 0 ? (
              <>
                <IconButton
                  label="Clear selection"
                  onClick={() => setSelected(new Set())}
                >
                  <XIcon />
                </IconButton>
                {allClosed ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reopen(picked)}
                  >
                    Reopen {pickedName}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => close(picked)}
                  >
                    Close {pickedName}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => askDelete(picked)}
                >
                  Delete {pickedName}…
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground tabular-nums">
                {rows.length} of {first.total} tasks
              </span>
            )}
          </div>
        </section>
        {task && detailActions && wide && (
          <aside
            aria-labelledby="task-details-title"
            className="flex w-96 shrink-0 flex-col border-l"
          >
            <div className="flex items-start gap-2 border-b p-4">
              <div className="grid min-w-0 flex-1 gap-1">
                <span className="font-mono text-muted-foreground text-xs">
                  {taskKey(task.id)}
                </span>
                <h2
                  id="task-details-title"
                  className="font-semibold text-lg leading-snug"
                >
                  {task.title}
                </h2>
              </div>
              <IconButton label="Close details" onClick={closeTask}>
                <XIcon />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <TaskDetails task={task} tasks={tasks} actions={detailActions} />
            </div>
          </aside>
        )}
      </div>
      <Sheet
        open={task !== undefined && !wide}
        onOpenChange={(open) => {
          if (!open) closeTask();
        }}
      >
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          {task && detailActions && (
            <>
              <div className="grid gap-1 border-b p-4 pr-12">
                <SheetDescription className="font-mono text-xs">
                  {taskKey(task.id)}
                </SheetDescription>
                <SheetTitle className="text-lg leading-snug">
                  {task.title}
                </SheetTitle>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <TaskDetails
                  task={task}
                  tasks={tasks}
                  actions={detailActions}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${tasksNamed(deleting)}?`}
        description={`${deleting.length === 1 ? "It goes" : "They go"} for good, with ${deleting.length === 1 ? "its" : "their"} description and links. Close ${deleting.length === 1 ? "it" : "them"} instead to keep the history.`}
        confirmLabel={`Delete ${deleting.length === 1 ? "task" : `${deleting.length} tasks`}`}
        destructive
        onConfirm={confirmDelete}
      />
      <NewTaskDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={(draft) => {
          const [created, made] = createTask(tasksRef.current, draft);
          tasksRef.current = created;
          setTasks(created);
          setCreating(false);
          run(filters);
          openTask(made.id);
          toast(`Created ${taskKey(made.id)}`);
        }}
      />
    </TooltipProvider>
  );
}
