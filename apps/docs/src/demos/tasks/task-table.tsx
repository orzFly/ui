import { TASK_PEOPLE, type Task } from "@orz/fixtures/tasks.ts";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import { Checkbox } from "@orz/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@orz/ui/components/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { cn } from "@orz/ui/lib/utils";
import {
  CircleCheckIcon,
  CircleDotIcon,
  EllipsisIcon,
  LinkIcon,
  PanelRightOpenIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { isOpen, taskKey } from "./board.ts";
import { taskHref } from "./location.ts";
import { Assignee, StatusDot } from "./parts.tsx";

/** What a row, its menu and the header's box do. */
export interface RowActions {
  onOpen: (id: number) => void;
  onSelect: (id: number, on: boolean) => void;
  onSelectAll: (on: boolean) => void;
  onClose: (ids: number[]) => void;
  onReopen: (ids: number[]) => void;
  onAssign: (id: number, login: string | null) => void;
  onCopyLink: (id: number) => void;
  onDelete: (ids: number[]) => void;
  onShowTheirs: (login: string) => void;
}

/** A click the browser should keep: a new tab, a download, a middle button. */
const isPlainClick = (event: MouseEvent) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

function RowMenu({ task, actions }: { task: Task; actions: RowActions }) {
  const key = taskKey(task.id);
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${key}`}
              className="size-8 touch:size-11"
            >
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>More actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => actions.onOpen(task.id)}>
          <PanelRightOpenIcon />
          Show details
        </DropdownMenuItem>
        {isOpen(task) ? (
          <DropdownMenuItem onSelect={() => actions.onClose([task.id])}>
            <CircleCheckIcon />
            Close
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => actions.onReopen([task.id])}>
            <CircleDotIcon />
            Reopen
          </DropdownMenuItem>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <UserIcon />
            Assign to
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuRadioGroup
              value={task.assignee ?? ""}
              onValueChange={(login) =>
                actions.onAssign(task.id, login === "" ? null : login)
              }
            >
              <DropdownMenuRadioItem value="">Nobody</DropdownMenuRadioItem>
              {TASK_PEOPLE.map(({ login, name }) => (
                <DropdownMenuRadioItem key={login} value={login}>
                  {name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => actions.onCopyLink(task.id)}>
          <LinkIcon />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => actions.onDelete([task.id])}
        >
          <Trash2Icon />
          Delete…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The task list as a table, which scrolls in its own box so the header stays above the rows; the
 * box is the table's container, which the caller sizes.
 *
 * A click anywhere on a row shows its details, except on a control in it; the title is a link as
 * well, so the details open from the keyboard and in a new tab.
 */
export function TaskTable({
  tasks,
  selected,
  openId,
  openCounts,
  actions,
  footer,
}: {
  tasks: readonly Task[];
  selected: ReadonlySet<number>;
  openId: number | null;
  /** Open tasks per assignee, for the hover card. */
  openCounts: Readonly<Record<string, number>>;
  actions: RowActions;
  /** A last row across every column: the Load more button. */
  footer?: ReactNode;
}) {
  const picked = tasks.filter((task) => selected.has(task.id)).length;
  const all = tasks.length > 0 && picked === tasks.length;
  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-background">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-px pl-4">
            <Checkbox
              checked={all ? true : picked > 0 ? "indeterminate" : false}
              onCheckedChange={() => actions.onSelectAll(!all && picked === 0)}
              aria-label={picked > 0 ? "Select none" : "Select all"}
            />
          </TableHead>
          <TableHead className="w-px max-sm:hidden">Task</TableHead>
          <TableHead className="w-full">Title</TableHead>
          <TableHead className="min-w-32 max-sm:hidden">Status</TableHead>
          <TableHead className="min-w-40 max-md:hidden">Assignee</TableHead>
          <TableHead className="min-w-36 max-lg:hidden">Labels</TableHead>
          <TableHead className="w-px pr-2">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const key = taskKey(task.id);
          const isSelected = selected.has(task.id);
          return (
            <TableRow
              key={task.id}
              data-task={task.id}
              data-state={isSelected ? "selected" : undefined}
              aria-current={task.id === openId ? "true" : undefined}
              onClick={(event) => {
                const target = event.target as Element;
                // Menus and cards portal out of the row; React still bubbles their clicks here.
                if (!event.currentTarget.contains(target)) return;
                if (target.closest("a, button, [role=checkbox]")) return;
                actions.onOpen(task.id);
              }}
              className={cn(
                "cursor-default touch:h-14",
                task.id === openId && "bg-accent hover:bg-accent",
              )}
            >
              <TableCell className="pl-4">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(on) =>
                    actions.onSelect(task.id, on === true)
                  }
                  aria-label={`Select ${key}`}
                />
              </TableCell>
              <TableCell className="font-mono text-muted-foreground text-ui-sm max-sm:hidden">
                {key}
              </TableCell>
              <TableCell className="max-w-0">
                <a
                  href={taskHref(task.id)}
                  onClick={(event) => {
                    if (!isPlainClick(event)) return;
                    event.preventDefault();
                    actions.onOpen(task.id);
                  }}
                  className={cn(
                    "block truncate font-medium outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring",
                    !isOpen(task) && "text-muted-foreground line-through",
                  )}
                >
                  {task.title}
                </a>
                {/* What the hidden columns held, on a screen too narrow for them. */}
                <span className="mt-0.5 flex items-center gap-2 text-muted-foreground text-ui-sm sm:hidden">
                  <span className="font-mono">{key}</span>
                  <StatusDot status={task.status} />
                </span>
              </TableCell>
              <TableCell className="max-sm:hidden">
                <StatusDot status={task.status} />
              </TableCell>
              <TableCell className="max-md:hidden">
                <Assignee
                  login={task.assignee}
                  openCount={
                    task.assignee ? (openCounts[task.assignee] ?? 0) : 0
                  }
                  onShowTheirs={() =>
                    task.assignee && actions.onShowTheirs(task.assignee)
                  }
                />
              </TableCell>
              <TableCell className="max-lg:hidden">
                <span className="flex gap-1">
                  {task.labels.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </span>
              </TableCell>
              <TableCell className="pr-2 text-right">
                <RowMenu task={task} actions={actions} />
              </TableCell>
            </TableRow>
          );
        })}
        {footer && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={7} className="p-3">
              {footer}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
