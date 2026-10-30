import type { TaskStatus } from "@orz/fixtures/tasks.ts";
import { Avatar, AvatarFallback } from "@orz/ui/components/avatar";
import { Button } from "@orz/ui/components/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@orz/ui/components/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { cn } from "@orz/ui/lib/utils";
import type { ComponentProps } from "react";
import { personOf, statusLabel } from "./board.ts";

/** UTC, so the prerendered page and every reader's browser print the same thing. */
const DAY = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

export function Stamp({ at }: { at: string }) {
  return (
    <time dateTime={at} className="tabular-nums">
      {DAY.format(new Date(at))} UTC
    </time>
  );
}

const DOT: Record<TaskStatus, string> = {
  todo: "border-2 border-muted-foreground",
  "in-progress": "bg-warning",
  review: "bg-primary",
  closed: "bg-success",
};

/** The colour is for a glance; the word beside it says the same for everyone. */
export function StatusDot({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden className={cn("size-2 rounded-full", DOT[status])} />
      {statusLabel(status)}
    </span>
  );
}

export function PersonAvatar({
  login,
  size = "sm",
}: {
  login: string;
  size?: "sm" | "default" | "lg";
}) {
  return (
    <Avatar size={size} aria-hidden>
      <AvatarFallback>{login.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

/**
 * An assignee's avatar and name, with a card on hover that says who they are. Hover only: a
 * finger taps the row instead, whose details name the assignee, and the card offers nothing the
 * Assignee filter does not.
 */
export function Assignee({
  login,
  openCount,
  onShowTheirs,
}: {
  login: string | null;
  /** How many open tasks they hold. */
  openCount: number;
  onShowTheirs: () => void;
}) {
  const person = login === null ? undefined : personOf(login);
  if (!person) {
    return <span className="text-muted-foreground">Nobody</span>;
  }
  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span className="inline-flex max-w-full items-center gap-2">
          <PersonAvatar login={person.login} />
          <span className="truncate">{person.name}</span>
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-64">
        <div className="flex gap-3">
          <PersonAvatar login={person.login} size="lg" />
          <div className="grid min-w-0 gap-0.5">
            <span className="truncate font-medium">{person.name}</span>
            <span className="truncate text-muted-foreground text-ui-sm">
              @{person.login} · {person.role}
            </span>
            <span className="text-muted-foreground text-ui-sm">
              {openCount === 1 ? "1 open task" : `${openCount} open tasks`}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={onShowTheirs}
        >
          Show their tasks
        </Button>
      </HoverCardContent>
    </HoverCard>
  );
}

/** An icon button, named by its tooltip. */
export function IconButton({
  label,
  children,
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
