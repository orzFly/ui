import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import { CircleCheckIcon, CircleXIcon, GitMergeIcon } from "lucide-react";

const failed = CI_RUN.jobs.filter((job) => job.status === "failed").length;

export function MergeBox() {
  return (
    <section
      aria-labelledby="merge-box-status"
      className="rounded-xl border bg-card text-card-foreground"
    >
      <header className="flex items-start gap-3 border-b p-4">
        <CircleXIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="min-w-0">
          <h3 id="merge-box-status" className="font-medium">
            Some checks were not successful
          </h3>
          <p className="text-muted-foreground text-ui">
            {failed} failing and {CI_RUN.jobs.length - failed} successful checks
            on{" "}
            <code className="rounded bg-muted px-1 font-mono text-ui-sm">
              {CI_RUN.commit}
            </code>
          </p>
        </div>
      </header>
      <ul className="divide-y">
        {CI_RUN.jobs.map((job) => (
          <li key={job.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate text-ui">
              {CI_RUN.workflow} / {job.name}
            </span>
            <span className="text-muted-foreground text-ui-sm tabular-nums">
              {job.duration}s
            </span>
            {job.status === "failed" ? (
              <Badge variant="destructive">
                <CircleXIcon /> Failed
              </Badge>
            ) : (
              <Badge variant="success">
                <CircleCheckIcon /> Passed
              </Badge>
            )}
          </li>
        ))}
      </ul>
      <footer className="flex flex-wrap items-center gap-3 border-t p-4">
        <Button disabled>
          <GitMergeIcon />
          Merge pull request
        </Button>
        <p className="text-muted-foreground text-ui">
          Merging is blocked until every check passes.
        </p>
      </footer>
    </section>
  );
}
