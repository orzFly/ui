import { Button } from "@orz/ui/components/button";
import { cn } from "@orz/ui/lib/utils";
import { Content } from "@orz/ui-content";
import {
  AttachmentList,
  useAttachmentViewer,
} from "@orz/ui-content/attachment";
import { PlayIcon } from "lucide-react";
import { Pane, StatusIcon } from "./parts.tsx";
import { CI_RUN, runFiles } from "./run.ts";

/** The run's jobs: a column beside the log on a wide screen, a row above it on a phone. */
function JobList({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect(id: string): void;
}) {
  return (
    <nav aria-labelledby="checks-run" className="md:w-52 md:shrink-0">
      <p
        id="checks-run"
        className="mb-1 flex items-center gap-2 px-2.5 font-medium text-sm"
      >
        <StatusIcon status={CI_RUN.status} />
        {CI_RUN.workflow} #{CI_RUN.id}
      </p>
      <ul aria-label="Jobs" className="flex gap-1 overflow-x-auto md:flex-col">
        {CI_RUN.jobs.map((job) => (
          <li key={job.id} className="shrink-0">
            <button
              type="button"
              aria-current={job.id === selected ? "true" : undefined}
              onClick={() => onSelect(job.id)}
              className={cn(
                "flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm transition-colors hover:bg-accent touch:min-h-11",
                job.id === selected && "bg-accent font-medium",
              )}
            >
              <StatusIcon status={job.status} />
              <span className="flex-1">{job.name}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {job.duration}s
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Opens the test job's terminal recording in the attachment viewer. */
function RecordingButton() {
  const viewer = useAttachmentViewer();
  return (
    <Button
      variant="outline"
      size="sm"
      className="touch:h-10"
      onClick={() => viewer?.show(runFiles().cast)}
    >
      <PlayIcon />
      Recording
    </Button>
  );
}

/**
 * The pull request's last CI run: its jobs, the selected one's log, and the files the run kept.
 * Every file is a `ContentSource`, and `Content` picks the package that draws it.
 */
export function Checks({
  job: selected,
  onJob,
}: {
  job: string;
  onJob(id: string): void;
}) {
  const job = CI_RUN.jobs.find((each) => each.id === selected);
  return (
    <div className="flex min-w-0 flex-col gap-4 md:flex-row">
      <JobList selected={selected} onSelect={onJob} />
      <div className="grid min-w-0 flex-1 gap-4">
        {job && (
          <section aria-labelledby="checks-job" className="grid min-w-0 gap-2">
            <div className="flex min-h-8 flex-wrap items-center gap-2">
              <StatusIcon status={job.status} />
              <h3 id="checks-job" className="font-semibold">
                {job.name}
              </h3>
              <span className="text-muted-foreground text-sm">
                {job.status} in {job.duration}s
              </span>
              {/* Only the test step was recorded: it is the one that fails. */}
              {job.id === "test" && (
                <span className="ml-auto">
                  <RecordingButton />
                </span>
              )}
            </div>
            <Pane>
              {() => {
                const source = runFiles().logs[job.id];
                return source ? (
                  <Content source={source} placement="viewer" />
                ) : null;
              }}
            </Pane>
          </section>
        )}
        <Pane height="h-24">
          {() => (
            <AttachmentList items={runFiles().artifacts} title="Artifacts" />
          )}
        </Pane>
      </div>
    </div>
  );
}
