import { Badge } from "@orz/ui/components/badge";
import { Skeleton } from "@orz/ui/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orz/ui/components/tabs";
import { cn } from "@orz/ui/lib/utils";
import { logContent } from "@orz/ui-ansi";
import { asciinemaContent } from "@orz/ui-asciinema";
import { codeContent, patchContent } from "@orz/ui-code";
import { Content, ContentRenderers } from "@orz/ui-content";
import {
  AttachmentList,
  AttachmentViewerProvider,
} from "@orz/ui-content/attachment";
import { hexContent } from "@orz/ui-hex/content";
import {
  CircleCheckIcon,
  CircleXIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  TimerIcon,
  UserIcon,
} from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { ClientOnly } from "../../hydrated.tsx";
import { CI_RUN, type CiJob, runFiles } from "./run.ts";

// In the order the registry tries them: a log before codeContent, which would
// take it as plain text, and hexContent last, for whatever binary is left.
const RENDERERS = [
  logContent,
  asciinemaContent,
  patchContent,
  codeContent,
  hexContent,
];

// What a pane in "viewer" placement fills: the log, the patch and the cast.
const PANE: CSSProperties & Record<`--${string}`, string> = {
  "--attachment-pane-height": "min(36rem, 70dvh)",
};

function StatusIcon({ status }: { status: CiJob["status"] }) {
  return status === "failed" ? (
    <CircleXIcon aria-label="failed" className="size-4 text-destructive" />
  ) : (
    <CircleCheckIcon aria-label="passed" className="size-4 text-success" />
  );
}

function RunHeader() {
  const failed = CI_RUN.status === "failed";
  const fact = "inline-flex items-center gap-1";
  return (
    <header className="grid gap-2 border-b p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={failed ? "destructive" : "success"}>
          <StatusIcon status={CI_RUN.status} />
          {failed ? "Failed" : "Passed"}
        </Badge>
        <span className="text-muted-foreground text-sm">
          {CI_RUN.workflow} #{CI_RUN.id}
        </span>
      </div>
      <h2 className="font-semibold text-lg leading-snug">{CI_RUN.title}</h2>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm">
        <span className={fact}>
          <GitBranchIcon className="size-3.5" />
          <span className="font-mono">{CI_RUN.branch}</span>
        </span>
        <span className={fact}>
          <GitCommitHorizontalIcon className="size-3.5" />
          <span className="font-mono">{CI_RUN.commit}</span>
        </span>
        <span className={fact}>
          <UserIcon className="size-3.5" />
          {CI_RUN.author}
        </span>
        <span className={fact}>
          <TimerIcon className="size-3.5" />
          {CI_RUN.duration}s
        </span>
      </p>
    </header>
  );
}

/** The run's jobs: a column beside the log on a wide screen, a row above it on a phone. */
function JobList({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect(id: string): void;
}) {
  return (
    <nav aria-label="Jobs" className="md:w-48 md:shrink-0">
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {CI_RUN.jobs.map((job) => (
          <li key={job.id} className="shrink-0">
            <button
              type="button"
              aria-current={job.id === selected ? "true" : undefined}
              onClick={() => onSelect(job.id)}
              className={cn(
                "flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm transition-colors hover:bg-accent pointer-coarse:min-h-11",
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

/** A pane drawn in the browser only: the renderers measure and fetch, which a prerender cannot. */
function Pane({ children }: { children: () => ReactNode }) {
  return (
    <ClientOnly
      fallback={<Skeleton className="h-(--attachment-pane-height) w-full" />}
    >
      {children()}
    </ClientOnly>
  );
}

/**
 * A CI run as an app would show one: the jobs and their logs, the change under test, a recording
 * of the failing step and the run's artifacts. Every file is a `ContentSource`, and `Content` picks
 * the package that draws it.
 */
export function LogViewer() {
  // The failed job first: it is why anyone opens a run.
  const [job, setJob] = useState(
    () => CI_RUN.jobs.find((each) => each.status === "failed")?.id ?? "",
  );
  return (
    <ContentRenderers renderers={RENDERERS}>
      <AttachmentViewerProvider>
        <div className="overflow-hidden rounded-xl border bg-card text-card-foreground">
          <RunHeader />
          <Tabs defaultValue="log" style={PANE} className="gap-0">
            <TabsList className="m-3 mb-0 max-w-[calc(100%-1.5rem)] overflow-x-auto">
              <TabsTrigger value="log">Log</TabsTrigger>
              <TabsTrigger value="changes">Changes</TabsTrigger>
              <TabsTrigger value="recording">Recording</TabsTrigger>
              <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
            </TabsList>
            <TabsContent
              value="log"
              className="flex min-w-0 flex-col gap-3 p-3 md:flex-row"
            >
              <JobList selected={job} onSelect={setJob} />
              <div className="min-w-0 flex-1">
                <Pane>
                  {() => {
                    const source = runFiles().logs[job];
                    return source ? (
                      <Content source={source} placement="viewer" />
                    ) : null;
                  }}
                </Pane>
              </div>
            </TabsContent>
            <TabsContent value="changes" className="min-w-0 p-3">
              <Pane>
                {() => (
                  <Content
                    source={runFiles().patch}
                    placement="viewer"
                    className="overflow-auto"
                  />
                )}
              </Pane>
            </TabsContent>
            {/* The player scales the terminal to its width; past this the text is poster-sized. */}
            <TabsContent
              value="recording"
              className="w-full min-w-0 max-w-4xl p-3"
            >
              <Pane>
                {() => <Content source={runFiles().cast} placement="viewer" />}
              </Pane>
            </TabsContent>
            <TabsContent value="artifacts" className="min-w-0 p-3">
              <Pane>
                {() => (
                  <AttachmentList
                    items={runFiles().artifacts}
                    title="Artifacts"
                  />
                )}
              </Pane>
            </TabsContent>
          </Tabs>
        </div>
      </AttachmentViewerProvider>
    </ContentRenderers>
  );
}
