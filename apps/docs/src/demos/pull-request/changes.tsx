import { cn } from "@orz/ui/lib/utils";
import { Content } from "@orz/ui-content";
import { useState } from "react";
import { Pane, Stamp, UserAvatar } from "./parts.tsx";
import { COMMITS, runFiles } from "./run.ts";

/** The pull request's commits, and the one picked drawn alone below them. */
export function Commits() {
  const [picked, setPicked] = useState(COMMITS[0]?.hash ?? "");
  return (
    <div className="grid min-w-0 gap-4">
      <ol aria-label="Commits" className="divide-y rounded-lg border">
        {COMMITS.map((commit) => (
          <li key={commit.hash}>
            <button
              type="button"
              aria-current={commit.hash === picked ? "true" : undefined}
              onClick={() => setPicked(commit.hash)}
              className={cn(
                "grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2 text-left transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-accent",
                commit.hash === picked && "bg-accent",
              )}
            >
              <span className="row-span-2">
                <UserAvatar login={commit.author} />
              </span>
              <span className="min-w-0 truncate font-medium text-sm">
                {commit.subject}
              </span>
              <code className="row-span-2 font-mono text-muted-foreground text-xs">
                {commit.hash}
              </code>
              <span className="text-muted-foreground text-xs">
                {commit.author} committed <Stamp at={commit.at} />
              </span>
            </button>
          </li>
        ))}
      </ol>
      <Pane>
        {() => {
          const source = runFiles().commits[picked];
          return source ? <Content source={source} placement="viewer" /> : null;
        }}
      </Pane>
    </div>
  );
}

/** Every file the pull request changes, as one diff. */
export function FilesChanged() {
  return (
    <Pane>{() => <Content source={runFiles().diff} placement="viewer" />}</Pane>
  );
}
