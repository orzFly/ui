import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import { Skeleton } from "@orz/ui/components/skeleton";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@orz/ui-codemirror/components/markdown-editor";
import { Markdown } from "@orz/ui-markdown";
import {
  CircleXIcon,
  GitCommitHorizontalIcon,
  GitMergeIcon,
  RotateCwIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ClientOnly } from "../../hydrated.tsx";
import { Stamp, StatusIcon, UserAvatar } from "./parts.tsx";
import {
  CI_RUN,
  COMMITS,
  PULL_REQUEST,
  PULL_REQUEST_ME,
  type PullRequestEvent,
} from "./run.ts";

function Comment({
  author,
  at,
  body,
  verb = "commented",
}: {
  author: string;
  at: string;
  body: string;
  verb?: string;
}) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-3">
      <span className="mt-1.5">
        <UserAvatar login={author} size="default" />
      </span>
      <article className="min-w-0 rounded-lg border bg-card text-card-foreground">
        <header className="flex flex-wrap items-baseline gap-x-1.5 rounded-t-lg border-b bg-muted/50 px-3 py-2 text-muted-foreground text-ui">
          <span className="font-medium text-foreground">{author}</span>
          {verb} <Stamp at={at} />
          {author === PULL_REQUEST.author && (
            <Badge variant="outline" className="ml-auto">
              Author
            </Badge>
          )}
        </header>
        <Markdown className="min-w-0 p-3 text-ui">{body}</Markdown>
      </article>
    </li>
  );
}

/** A line between the comments for what happened to the branch: a push, a run. */
function Event({
  event,
  onChecks,
}: {
  event: Exclude<PullRequestEvent, { kind: "comment" }>;
  onChecks(): void;
}) {
  const row =
    "flex flex-wrap items-center gap-x-2 gap-y-1 py-1 pl-2.5 text-muted-foreground text-ui";
  if (event.kind === "push") {
    const commit = COMMITS.find((each) => each.hash === event.commit);
    return (
      <li className={row}>
        <GitCommitHorizontalIcon className="size-4 shrink-0" />
        <span>
          <span className="font-medium text-foreground">{event.author}</span>{" "}
          pushed
        </span>
        <code className="font-mono text-ui-sm">{event.commit}</code>
        <span className="min-w-0 truncate text-foreground">
          {commit?.subject}
        </span>
        <span className="ml-auto text-ui-sm">
          <Stamp at={event.at} />
        </span>
      </li>
    );
  }
  return (
    <li className={row}>
      <StatusIcon status={event.status} />
      <span>
        {CI_RUN.workflow} #{event.run} {event.status}
      </span>
      <Button
        variant="link"
        size="sm"
        className="h-auto px-0"
        onClick={onChecks}
      >
        Details
      </Button>
      <span className="ml-auto text-ui-sm">
        <Stamp at={event.at} />
      </span>
    </li>
  );
}

/** How long a re-run takes: long enough to switch to another tab meanwhile. */
const RERUN_MS = 5000;

/** Why the pull request cannot merge yet: each check, and a way into its log. */
function MergeBox({ onJob }: { onJob(id: string): void }) {
  const failing = CI_RUN.jobs.filter((job) => job.status === "failed");
  const failed = failing.length;
  const [rerunning, setRerunning] = useState(false);
  // The run ends wherever the reader has gone meanwhile, so it says so in a toast that leads back.
  const rerun = () => {
    setRerunning(true);
    setTimeout(() => {
      setRerunning(false);
      const [job] = failing;
      if (!job) return;
      toast.error(`${job.name} failed again in ${CI_RUN.workflow}`, {
        action: { label: "Details", onClick: () => onJob(job.id) },
      });
    }, RERUN_MS);
  };
  return (
    <section
      aria-labelledby="merge-status"
      className="ml-11 rounded-lg border bg-card text-card-foreground"
    >
      <header className="flex flex-wrap items-start gap-3 border-b p-3">
        <CircleXIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <h3 id="merge-status" className="font-semibold">
            Some checks were not successful
          </h3>
          <p className="text-muted-foreground text-ui">
            {failed} failing and {CI_RUN.jobs.length - failed} successful checks
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={rerunning}
          onClick={rerun}
          className="touch:h-10"
        >
          <RotateCwIcon className={rerunning ? "animate-spin" : undefined} />
          {rerunning ? "Re-running…" : "Re-run failed jobs"}
        </Button>
      </header>
      <ul className="divide-y">
        {CI_RUN.jobs.map((job) => (
          <li
            key={job.id}
            className="flex min-h-10 items-center gap-2 px-3 text-ui"
          >
            <StatusIcon status={job.status} />
            <span className="flex-1">
              {CI_RUN.workflow} / {job.name}
            </span>
            <span className="text-muted-foreground text-ui-sm tabular-nums">
              {job.duration}s
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="touch:h-10"
              aria-label={`Details for ${job.name}`}
              onClick={() => onJob(job.id)}
            >
              Details
            </Button>
          </li>
        ))}
      </ul>
      <footer className="flex flex-wrap items-center gap-3 border-t p-3">
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

/** The comment box at the end of the timeline; what it posts lives only in this page's memory. */
function CommentForm({ onPost }: { onPost(body: string): void }) {
  const editor = useRef<MarkdownEditorHandle>(null);
  // Comment stays pressable, and says what is missing, rather than greying out unexplained.
  const [missing, setMissing] = useState(false);
  const post = (value: string) => {
    if (value.trim() === "") {
      setMissing(true);
      editor.current?.focus();
      return;
    }
    onPost(value.trim());
    editor.current?.setValue("");
  };
  return (
    <form
      aria-label="Comment"
      onSubmit={(event) => {
        event.preventDefault();
        post(editor.current?.getValue() ?? "");
      }}
      className="grid grid-cols-[auto_1fr] gap-3"
    >
      <span className="mt-1.5">
        <UserAvatar login={PULL_REQUEST_ME} size="default" />
      </span>
      <div className="grid min-w-0 gap-2 rounded-lg border bg-card p-2">
        {/* CodeMirror measures the page, which a prerender has none of. */}
        <ClientOnly fallback={<Skeleton className="h-20 w-full" />}>
          <MarkdownEditor
            ref={editor}
            ariaLabel="Comment"
            placeholder="Leave a comment in markdown…"
            onSubmit={post}
            onChange={(value) => {
              if (value.trim() !== "") setMissing(false);
            }}
            className="max-h-[40dvh] min-h-20"
          />
        </ClientOnly>
        <div className="flex items-center justify-end gap-3">
          <p role="status" className="text-destructive text-ui">
            {missing && "Write a comment first."}
          </p>
          <Button type="submit">Comment</Button>
        </div>
      </div>
    </form>
  );
}

function Sidebar() {
  const heading = "mb-1.5 font-medium text-muted-foreground text-ui-sm";
  const person = "flex min-h-8 items-center gap-2 text-ui";
  return (
    <aside
      aria-label="Details"
      className="grid content-start gap-4 lg:sticky lg:top-4"
    >
      <section>
        <h3 className={heading}>Reviewers</h3>
        {PULL_REQUEST.reviewers.map((login) => (
          <p key={login} className={person}>
            <UserAvatar login={login} />
            {login}
          </p>
        ))}
      </section>
      <section>
        <h3 className={heading}>Assignee</h3>
        <p className={person}>
          <UserAvatar login={PULL_REQUEST.author} />
          {PULL_REQUEST.author}
        </p>
      </section>
      <section>
        <h3 className={heading}>Labels</h3>
        <p className="flex flex-wrap gap-1">
          {PULL_REQUEST.labels.map((label) => (
            <Badge key={label} variant="outline">
              {label}
            </Badge>
          ))}
        </p>
      </section>
    </aside>
  );
}

/**
 * The pull request's description and what has happened on it since, the checks blocking the
 * merge, and a box to answer in.
 */
export function Conversation({
  timeline,
  onPost,
  onJob,
}: {
  timeline: PullRequestEvent[];
  onPost(body: string): void;
  /** Opens a job's log on the Checks tab. */
  onJob(id: string): void;
}) {
  const failed =
    CI_RUN.jobs.find((job) => job.status === "failed") ?? CI_RUN.jobs[0];
  const showRun = () => failed && onJob(failed.id);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
      <div className="grid min-w-0 content-start gap-4">
        <ol aria-label="Timeline" className="grid gap-3">
          <Comment
            author={PULL_REQUEST.author}
            at={PULL_REQUEST.openedAt}
            body={PULL_REQUEST.body}
            verb="opened this"
          />
          {timeline.map((event) =>
            event.kind === "comment" ? (
              <Comment
                key={`${event.author}-${event.at}`}
                author={event.author}
                at={event.at}
                body={event.body}
              />
            ) : (
              <Event
                key={`${event.kind}-${event.at}`}
                event={event}
                onChecks={showRun}
              />
            ),
          )}
        </ol>
        <MergeBox onJob={onJob} />
        <CommentForm onPost={onPost} />
      </div>
      <Sidebar />
    </div>
  );
}
