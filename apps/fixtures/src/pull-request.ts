/** One entry on a pull request's timeline, oldest first; a comment's `body` is markdown. */
export type PullRequestEvent =
  | { kind: "comment"; author: string; at: string; body: string }
  | { kind: "push"; author: string; at: string; commit: string }
  | { kind: "check"; at: string; run: number; status: "passed" | "failed" };

/**
 * The pull request `patch/series.patch` is the change of, and `CI_RUN` its last run: opened by
 * alice, reviewed by claude-agent, with a docs commit from bot-one on top that the run fails on.
 */
export const PULL_REQUEST = {
  repo: { owner: "example", name: "fetch-task" },
  number: 12,
  title: "feat: retry a failed fetch once before giving up",
  author: "alice",
  base: "master",
  head: "retry-once",
  openedAt: "2026-10-20T16:10:00Z",
  /** Open issues and pull requests in the repository, for its tab bar. */
  openIssues: 4,
  openPulls: 1,
  labels: ["enhancement", "network"],
  reviewers: ["claude-agent"],
  body: `A flaky network used to fail the whole task on its first error. This retries a failed
fetch **once**, after a short pause, which covers the common blip without hiding a real outage.

- \`retryOnce\` in \`src/retry.ts\` runs an attempt, and once more after 250 ms if it throws.
- \`fetchTask\` goes through it; an error status from the server is still thrown at once.

Closes the "task fails on a dropped connection" report.`,
  timeline: [
    {
      kind: "push",
      author: "alice",
      at: "2026-10-20T16:04:27Z",
      commit: "4c1d2e8",
    },
    {
      kind: "push",
      author: "bot-one",
      at: "2026-10-21T09:11:37Z",
      commit: "7e6f5d4",
    },
    { kind: "check", at: "2026-10-21T09:14:14Z", run: 1284, status: "failed" },
    {
      kind: "comment",
      author: "claude-agent",
      at: "2026-10-21T09:22:40Z",
      body: `The retry reads well. One thing: an error status now throws from inside the attempt,
so \`retryOnce\` retries a 404 too:

\`\`\`ts
if (!response.ok) {
  throw new Error(\`task \${id}: \${response.status}\`);
}
\`\`\`

Could a status error skip the second attempt? The README change says it does.`,
    },
    {
      kind: "comment",
      author: "alice",
      at: "2026-10-21T09:31:05Z",
      body: `Good catch, a status error will skip the retry.

\`Test\` is red for another reason: \`flaky.test.ts\` waits on the real 250 ms pause. I'll
put it on fake timers in the same push.`,
    },
  ] satisfies PullRequestEvent[],
};

/** Who the reader is: the author of a comment they post. */
export const PULL_REQUEST_ME = "alice";
