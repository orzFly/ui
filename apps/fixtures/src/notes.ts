/** One note in a notebook: markdown whose first heading is its title and whose `#words` are its tags. */
export interface Note {
  id: string;
  folder: string;
  /** ISO 8601, UTC. */
  updated: string;
  body: string;
}

/** The notebook's folders, in the order its sidebar lists them. */
export const NOTE_FOLDERS = ["Projects", "Meetings", "Journal"] as const;

const RETRY_DESIGN = `# Retry design

The fetch task gives up on the first network error, and most of the failures in CI last week were
a single dropped connection. #design #fetch

## Proposal

Retry **once**, after a short pause, and only for errors that a second try can fix.

\`\`\`mermaid
flowchart TD
  fetch([fetch]) --> ok{2xx?}
  ok -- yes --> done([return the body])
  ok -- no --> retry{retryable?}
  retry -- "timeout, 502, 503" --> again([pause, fetch again]) --> done
  retry -- 4xx --> fail([throw])
\`\`\`

| Error | Retry? | Why |
| --- | --- | --- |
| Timeout | yes | The far end may just be slow |
| 502, 503 | yes | A proxy restarting |
| 4xx | no | The request itself is wrong |

\`\`\`ts
export async function retryOnce<T>(attempt: () => Promise<T>): Promise<T> {
  try {
    return await attempt();
  } catch (error) {
    if (!isRetryable(error)) throw error;
    await sleep(PAUSE_MS);
    return attempt();
  }
}
\`\`\`

## Open questions

- [x] Does a retry need its own timeout? No: the pause is short.
- [ ] Should the pause grow with each attempt? Only once we retry more than once.
- [ ] Log the first failure, or only the second?

The current implementation: [fetch-task.ts](files/fetch-task.ts).
`;

const RELEASE = `# Release 0.4 checklist

Everything between the branch cut and the tag. #release

\`\`\`mermaid
gitGraph
  commit id: "retry"
  commit id: "docs"
  branch release-0.4
  commit id: "freeze deps"
  checkout main
  commit id: "next feature"
  checkout release-0.4
  commit id: "retry fix"
  commit id: "notes" tag: "v0.4.0"
\`\`\`

- [x] Cut \`release-0.4\` from master
- [x] Freeze the dependency updates
- [ ] Retry fix merged (see the retry design)
- [ ] Release notes reviewed by @alice
- [ ] Tag \`v0.4.0\` and watch the publish job

The steps below are the team's release guide, embedded as it stands:

![release guide](files/guide.md)
`;

const JOB_STATES = `# Job states

What a CI job goes through, for the status badge and the re-run button. #design #ci

\`\`\`mermaid
stateDiagram-v2
  [*] --> Queued
  Queued --> Running: a runner picks it up
  Running --> Passed
  Running --> Failed
  Running --> Cancelled: someone stops it
  Failed --> Queued: re-run
  Cancelled --> Queued: re-run
  Passed --> [*]
\`\`\`

Only **Failed** and **Cancelled** offer *Re-run*; a passed job is re-run from the commit instead.

<details>
<summary>Why no "Skipped" state?</summary>

A job that is skipped never enters the queue, so the run lists it greyed out without a state of
its own.

</details>
`;

const SYNC = `# Sync, Oct 27

**Present:** alice, bot-one, claude-agent. #meeting

## How a failing job reaches a person

\`\`\`mermaid
sequenceDiagram
  participant R as runner
  participant B as bot-one
  participant A as alice
  R->>B: job failed (exit 1)
  B->>B: match against known flakes
  alt known flake
    B->>R: re-run once
  else new failure
    B->>A: open a card with the log
  end
\`\`\`

## Decisions

1. The retry ships in 0.4, behind no flag.
2. bot-one stops re-running a job more than once.

## Action items

- [ ] alice — review the retry pull request
- [ ] claude-agent — write the release notes draft
- [x] bot-one — post the flake list to the channel
`;

const ONBOARDING = `# Onboarding: newcomer

A first week for newcomer, who joins on Nov 2. #onboarding

## Day one

- [ ] Accounts: the forge, the tracker, the chat
- [ ] Clone the repository and run the tests
- [ ] Read the [release guide](files/guide.md)

## Questions people ask

<details>
<summary>Where do the sample files come from?</summary>

From the fixtures package. Nothing in it is real data, so it is safe to show anywhere.

</details>

<details>
<summary>Who reviews my first change?</summary>

alice, or whoever the tracker suggests for the area you touched.

</details>
`;

const OCT_28 = `# Oct 28

Wrote up the job states. The re-run rule took longer than the diagram. #ci

Tomorrow: pair with alice on the retry review.
`;

const OCT_24 = `# Oct 24

Counted last week's CI failures: #ci

| Cause | Failures |
| --- | ---: |
| Dropped connection | 9 |
| Real test failure | 4 |
| Runner out of disk | 1 |

Nine of fourteen would have passed on a second try, which is the case for the retry design.
`;

export const NOTES: readonly Note[] = [
  {
    id: "retry-design",
    folder: "Projects",
    updated: "2026-10-27T15:42:00Z",
    body: RETRY_DESIGN,
  },
  {
    id: "release-checklist",
    folder: "Projects",
    updated: "2026-10-26T09:10:00Z",
    body: RELEASE,
  },
  {
    id: "job-states",
    folder: "Projects",
    updated: "2026-10-28T11:05:00Z",
    body: JOB_STATES,
  },
  {
    id: "sync-10-27",
    folder: "Meetings",
    updated: "2026-10-27T10:30:00Z",
    body: SYNC,
  },
  {
    id: "onboarding",
    folder: "Meetings",
    updated: "2026-10-25T16:00:00Z",
    body: ONBOARDING,
  },
  {
    id: "oct-28",
    folder: "Journal",
    updated: "2026-10-28T18:20:00Z",
    body: OCT_28,
  },
  {
    id: "oct-24",
    folder: "Journal",
    updated: "2026-10-24T17:45:00Z",
    body: OCT_24,
  },
];
