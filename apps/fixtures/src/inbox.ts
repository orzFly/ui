/** One message in a conversation; `body` is markdown. */
export interface InboxMessage {
  from: string;
  /** ISO 8601, UTC. */
  at: string;
  body: string;
  /** Who it went to, for a message the reader wrote. */
  to?: string[];
}

/**
 * Where a thread is filed. A thread the reader started and nobody has answered is in `sent`; one
 * with an answer is in `inbox`, and shows under Sent as well.
 */
export type InboxFolder = "inbox" | "sent" | "drafts" | "archive" | "trash";

export interface InboxThread {
  id: string;
  subject: string;
  labels: string[];
  unread: boolean;
  starred: boolean;
  /** `inbox` when left out. */
  folder?: InboxFolder;
  /** Oldest first. */
  messages: InboxMessage[];
}

/** Who the reader is: the `from` of a reply they send. */
export const INBOX_ME = "user";

export const INBOX_PEOPLE: Readonly<Record<string, string>> = {
  user: "You",
  alice: "Alice",
  "bot-one": "bot-one",
  "claude-agent": "claude-agent",
  newcomer: "Newcomer",
  ci: "CI",
};

export const INBOX_LABELS = [
  "review",
  "ci",
  "design",
  "release",
  "docs",
  "support",
] as const;

/** Minutes after 2026-10-26 08:00 UTC, as an ISO string. */
const at = (minutes: number) =>
  new Date(Date.UTC(2026, 9, 26, 8, 0) + minutes * 60_000).toISOString();

const WRITTEN: InboxThread[] = [
  {
    id: "retry-write-up",
    subject: "Notes for the retry write-up",
    labels: ["docs"],
    unread: false,
    starred: false,
    folder: "drafts",
    messages: [
      {
        from: "user",
        to: ["claude-agent"],
        at: at(1_650),
        body: "Could the write-up say *why* the fetch retries only once? A second retry",
      },
    ],
  },
  {
    id: "touch-sizes",
    subject: "Touch sizes for the toolbar icons",
    labels: ["design", "review"],
    unread: true,
    starred: true,
    messages: [
      {
        from: "alice",
        at: at(1_500),
        body: `The toolbar icons are 32px on a phone, which is under the 44px the guidelines ask for.

Two ways out:

1. Grow the buttons to \`size-11\` under \`touch:\`, and let the toolbar wrap.
2. Keep the drawn size and widen the hit area with \`touch:hit-area\`.

I lean to **2**: the toolbar is dense on purpose, and wrapping it moves the
icons people have learned. Thoughts?`,
      },
      {
        from: "claude-agent",
        at: at(1_542),
        body: `Agreed on 2. Measured on a 390px screen:

| Control | Drawn | Hit area |
|---|---|---|
| Icon button | 32px | 44px |
| Toolbar row | 40px | 44px |

Neighbouring hit areas overlap by 6px between icons spaced \`gap-1\`, so the
gap needs to grow to \`gap-2\` on touch, or a tap between two lands on the
wrong one.`,
      },
      {
        from: "alice",
        at: at(1_610),
        body: "Good catch on the overlap. Can you push the `gap-2` change to the branch?",
      },
    ],
  },
  {
    id: "release-0-9",
    subject: "Release 0.9.0: changelog draft",
    labels: ["release"],
    unread: true,
    starred: false,
    messages: [
      {
        from: "bot-one",
        at: at(1_380),
        body: `Draft changelog for **0.9.0**, generated from the merged cards:

### Added
- \`RadioGroup\`, for one choice out of two to five
- \`touch:\` variant and coarse-pointer sizes for every control
- The docs site, with guidelines and demos

### Fixed
- Muted and destructive text clear 4.5:1 in every built-in palette
- Overlays keep to a fade under \`prefers-reduced-motion\`

Reply with corrections; the tag goes out tomorrow at 10:00 UTC.`,
      },
    ],
  },
  {
    id: "flaky-retry",
    subject: "Flaky test: retry-once times out on the slow runner",
    labels: ["ci"],
    unread: false,
    starred: false,
    messages: [
      {
        from: "ci",
        at: at(1_200),
        body: `\`test/retry.test.ts › retries once, then gives up\` failed on **bot-one**.

\`\`\`
AssertionError: expected 2 calls, got 1
  at test/retry.test.ts:41:23
\`\`\`

It passed on the re-run. Third time this week.`,
      },
      {
        from: "newcomer",
        at: at(1_260),
        body: `I can take this one. The test waits 100ms for the retry, and the slow
runner takes longer than that to schedule the timer. Faking the clock
should make it deterministic:

\`\`\`ts
vi.useFakeTimers();
const pending = retryOnce(load);
await vi.advanceTimersByTimeAsync(100);
\`\`\``,
      },
      {
        from: "alice",
        at: at(1_275),
        body: "Yes please — and welcome aboard!",
      },
    ],
  },
  {
    id: "docs-search",
    subject: "Search on the docs site ranks the Storybook pages too high",
    labels: ["docs", "support"],
    unread: true,
    starred: false,
    messages: [
      {
        from: "newcomer",
        at: at(1_100),
        body: `Searching for **switch** puts three Storybook links above the
*Choosing a control* page, which is the one that answers "should I use a
switch here?". Is that intended?`,
      },
    ],
  },
  {
    id: "design-review-agenda",
    subject: "Agenda for Thursday's design review",
    labels: ["design"],
    unread: false,
    starred: false,
    folder: "sent",
    messages: [
      {
        from: "user",
        to: ["alice", "newcomer"],
        at: at(1_000),
        body: `Three things, half an hour:

1. The touch sizes for the toolbar icons
2. Whether the filter menu becomes a Sheet on a phone
3. The contrast audit's two failing tokens`,
      },
    ],
  },
  {
    id: "contrast-audit",
    subject: "Contrast audit results",
    labels: ["design"],
    unread: false,
    starred: true,
    messages: [
      {
        from: "claude-agent",
        at: at(900),
        body: `Every built-in palette now clears **4.5:1** for body, muted and destructive
text, in light and dark. The lowest pairs:

- \`muted-foreground\` on \`muted\`: 4.61:1 (Solarized light)
- destructive button text on its tint: 4.52:1 (Nord dark)

The test pins both, so a palette edit that drops below fails CI.`,
      },
      {
        from: "alice",
        at: at(960),
        body: "Lovely. Closing the card.",
      },
    ],
  },
  {
    id: "onboarding",
    subject: "Welcome — where to start",
    labels: ["docs"],
    unread: false,
    starred: false,
    messages: [
      {
        from: "alice",
        at: at(600),
        body: `Welcome! A short reading list for your first week:

1. The **Principles** page, start to finish — it is short.
2. *Choosing a control* and *Overlays*: most review comments point there.
3. Run \`pnpm --filter @orz/docs dev\` and click through the demos on your phone.

Ask anything in this thread; there are no silly questions.`,
      },
      {
        from: "newcomer",
        at: at(655),
        body: "Thanks! Reading Principles now.",
      },
    ],
  },
  {
    id: "query-braces",
    subject: "Braces in label filters",
    labels: ["review"],
    unread: false,
    starred: false,
    messages: [
      {
        from: "bot-one",
        at: at(420),
        body: `Heads-up: \`label:{kind:bug,area:web}\` now completes inside the braces.
Each value in the group is checked against the label list, so a typo is
underlined where it sits rather than on the whole filter.`,
      },
    ],
  },
  {
    id: "sheet-phone",
    subject: "Popover or Sheet on a phone?",
    labels: ["design", "support"],
    unread: false,
    starred: false,
    messages: [
      {
        from: "newcomer",
        at: at(300),
        body: "The filter menu opens as a popover on a phone and half of it is off screen. Should it be a Sheet there?",
      },
      {
        from: "alice",
        at: at(330),
        body: `Yes — the *Overlays* guideline has the table. In short: a popover anchors
to its trigger, which a phone has no room for; a bottom Sheet is where the
thumb already is.`,
      },
    ],
  },
];

const NOTICES: readonly [string, string, string][] = [
  ["ci", "ci", "main passed: 412 tests in 38s"],
  ["bot-one", "review", "Review requested: tidy the Tabs touch sizes"],
  ["ci", "ci", "Nightly visual diff: no changes"],
  ["bot-one", "release", "Snapshot published under the master tag"],
  ["claude-agent", "review", "Ready to Ship: load-more keeps focus on retry"],
  ["ci", "ci", "main passed: 409 tests in 41s"],
  ["bot-one", "docs", "Broken link report: none found"],
  ["alice", "design", "Icon set: lucide 1.59 picked up"],
];

/**
 * The automated mail an inbox fills up with, one a little older than the last, so the list runs
 * long enough to need its pages.
 */
const GENERATED: InboxThread[] = Array.from({ length: 40 }, (_, i) => {
  const [from, label, subject] = NOTICES[i % NOTICES.length] as [
    string,
    string,
    string,
  ];
  const week = Math.floor(i / NOTICES.length);
  return {
    id: `notice-${i + 1}`,
    subject: week === 0 ? subject : `${subject} (week ${week + 1})`,
    labels: [label],
    unread: i % 7 === 2,
    starred: false,
    // Older notices were dealt with: every fifth archived, the oldest thrown away.
    folder: i === 39 ? "trash" : i % 5 === 4 ? "archive" : "inbox",
    messages: [
      {
        from,
        at: at(240 - (i + 1) * 180),
        body: `${subject}.\n\nNothing to do — this is a notice.`,
      },
    ],
  };
});

/** Newest first, as an inbox lists them. */
export const INBOX_THREADS: readonly InboxThread[] = [...WRITTEN, ...GENERATED];
