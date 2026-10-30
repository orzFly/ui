import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import { Badge } from "@orz/ui/components/badge";
import { CircleCheckIcon, CircleXIcon } from "lucide-react";

export function ThemedChecks() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card text-card-foreground">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-ui">
        <span className="min-w-0 flex-1 truncate font-medium">
          {CI_RUN.workflow} #{CI_RUN.id}
        </span>
        <code className="rounded bg-muted px-1 font-mono text-muted-foreground text-ui-sm">
          {CI_RUN.branch}
        </code>
        <Badge variant="destructive">
          <CircleXIcon /> Failed
        </Badge>
      </div>
      <ul className="py-1 text-ui">
        {CI_RUN.jobs.map((job) => (
          <li key={job.id} className="flex items-center gap-2 px-3 py-1.5">
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
      </ul>
    </div>
  );
}
