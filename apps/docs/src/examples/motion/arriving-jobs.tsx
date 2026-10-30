import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import { Button } from "@orz/ui/components/button";
import { Skeleton } from "@orz/ui/components/skeleton";
import { CircleCheckIcon, CircleXIcon, RotateCwIcon } from "lucide-react";
import { useEffect, useState } from "react";

const JOB_MS = 1200;

export function ArrivingJobs() {
  const [finished, setFinished] = useState(CI_RUN.jobs.length);
  const running = finished < CI_RUN.jobs.length;
  useEffect(() => {
    if (finished === CI_RUN.jobs.length) return;
    const timer = setTimeout(() => setFinished(finished + 1), JOB_MS);
    return () => clearTimeout(timer);
  }, [finished]);
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-ui">
          {CI_RUN.workflow} #{CI_RUN.id}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={running}
          onClick={() => setFinished(0)}
        >
          <RotateCwIcon data-icon="inline-start" /> Re-run all jobs
        </Button>
      </div>
      <ol aria-label="Jobs" className="grid gap-1 text-ui">
        {CI_RUN.jobs.slice(0, finished).map((job) => (
          <li
            key={job.id}
            className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150 ease-out"
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
            <span className="flex-1">{job.name}</span>
            <span className="text-muted-foreground text-ui-sm tabular-nums">
              {job.duration}s
            </span>
          </li>
        ))}
        {running && (
          <li>
            <Skeleton className="h-8 w-full" />
            <span className="sr-only">
              {CI_RUN.jobs[finished]?.name} is running
            </span>
          </li>
        )}
      </ol>
    </div>
  );
}
