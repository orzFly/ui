import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import { Button } from "@orz/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import {
  CircleCheckIcon,
  CircleXIcon,
  PlayIcon,
  RefreshCwIcon,
  ScrollTextIcon,
} from "lucide-react";

export function CiRunPanel() {
  return (
    <TooltipProvider>
      <div className="overflow-hidden rounded-xl border bg-card text-card-foreground">
        <div className="flex items-center gap-2 border-b px-3 py-1.5">
          <CircleXIcon
            aria-label="failed"
            className="size-4 shrink-0 text-destructive"
          />
          <span className="min-w-0 flex-1 truncate font-medium text-sm">
            {CI_RUN.workflow} #{CI_RUN.id}
          </span>
          <Button variant="outline" size="sm">
            <PlayIcon data-icon="inline-start" /> Recording
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Refresh">
                <RefreshCwIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </div>
        <ul className="py-1">
          {CI_RUN.jobs.map((job) => (
            <li
              key={job.id}
              className="flex min-h-9 items-center gap-2 px-3 text-sm touch:min-h-11"
            >
              {job.status === "failed" ? (
                <CircleXIcon
                  aria-label="failed"
                  className="size-4 shrink-0 text-destructive"
                />
              ) : (
                <CircleCheckIcon
                  aria-label="passed"
                  className="size-4 shrink-0 text-success"
                />
              )}
              <span className="min-w-0 flex-1 truncate">{job.name}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {job.duration}s
              </span>
              <Button
                variant="ghost"
                size="xs"
                aria-label={`Log for ${job.name}`}
              >
                <ScrollTextIcon data-icon="inline-start" /> Log
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 border-t px-3 py-2">
          <Button variant="outline">Re-run all jobs</Button>
          <Button>Re-run failed jobs</Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
