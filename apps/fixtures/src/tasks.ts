/** Where a task stands. `todo`, `in-progress` and `review` all count as open. */
export type TaskStatus = "todo" | "in-progress" | "review" | "closed";

export interface Task {
  /** Shown as `T-<id>`; a higher id is a newer task. */
  id: number;
  title: string;
  status: TaskStatus;
  /** A login from `TASK_PEOPLE`, or null while nobody has it. */
  assignee: string | null;
  labels: string[];
  /** Other tasks this one mentions, by id. */
  related: number[];
  /** Plain text, paragraphs split by a blank line; empty when nobody wrote one. */
  body: string;
  /** ISO 8601, UTC. */
  updated: string;
}

export interface TaskPerson {
  login: string;
  name: string;
  role: string;
}

export const TASK_PEOPLE: readonly TaskPerson[] = [
  { login: "alice", name: "Alice", role: "Maintainer" },
  { login: "bot-one", name: "bot-one", role: "Release bot" },
  { login: "claude-agent", name: "claude-agent", role: "Coding agent" },
  { login: "newcomer", name: "Newcomer", role: "First-time contributor" },
];

export const TASK_LABELS = [
  "bug",
  "ci",
  "docs",
  "design",
  "perf",
  "release",
] as const;

/** Oldest first: the task at index `i` is `T-<i + 1>`. */
const TITLES: readonly (readonly [string, string])[] = [
  ["Set up the workspace build", "ci"],
  ["Pick a licence for the packages", "release"],
  ["Write the contributing guide", "docs"],
  ["Lint on every push", "ci"],
  ["Button sizes on touch screens", "design"],
  ["Dialog traps focus twice", "bug"],
  ["Document the theme tokens", "docs"],
  ["Dark mode borders too faint", "design"],
  ["Cache the pnpm store in CI", "ci"],
  ["Table header scrolls away", "bug"],
  ["First snapshot release", "release"],
  ["Tooltip shows under the sheet", "bug"],
  ["Explain the source condition", "docs"],
  ["Large patch freezes the diff view", "perf"],
  ["Colour contrast audit", "design"],
  ["Publish from the mirror only", "release"],
  ["Select loses its value on reset", "bug"],
  ["Split the markdown package", "perf"],
  ["Storybook page per export", "docs"],
  ["Menu items too close on a phone", "design"],
  ["Run the tests on Node 24", "ci"],
  ["Toast hides the bottom bar", "bug"],
  ["Lazy-load the mermaid renderer", "perf"],
  ["Changelog for 0.5.0", "release"],
  ["Focus ring on the query box", "design"],
  ["Log view jumps while following", "bug"],
  ["Guideline page for forms", "docs"],
  ["Visual diff on pull requests", "ci"],
  ["Shrink the hex view bundle", "perf"],
  ["Avatar fallback is off-centre", "bug"],
  ["Spacing scale for dense tables", "design"],
  ["Changelog for 0.6.0", "release"],
  ["Search the docs site", "docs"],
  ["Flaky test in the player", "ci"],
  ["Theme editor drops a pasted colour", "bug"],
  ["Virtualise long logs", "perf"],
  ["Icons for empty states", "design"],
  ["Load more keeps focus on retry", "bug"],
  ["Explain undo over confirm", "docs"],
  ["Hex view drops the last byte", "bug"],
  ["Ship the release notes", "release"],
  ["Retry a failed fetch once", "ci"],
  ["Sheet handle on a phone", "design"],
  ["Prerender every docs page", "perf"],
  ["Code block wraps in the wrong place", "bug"],
  ["Nightly link check", "ci"],
  ["Recipe for a settings screen", "docs"],
  ["Badge colours in high contrast", "design"],
  ["Changelog for 0.9.0", "release"],
  ["Hover card opens on focus too", "bug"],
  ["Measure the first paint of a demo", "perf"],
  ["Filter menu folds diacritics", "design"],
  ["Pin the devshell toolchain", "ci"],
  ["Write down the sanitization rules", "docs"],
  ["Copy link in the row menu", "design"],
  ["Ansi colours ignore the theme", "bug"],
  ["Smaller font files", "perf"],
  ["Tag a release from the mirror", "release"],
  ["Undo after closing a task", "design"],
  ["Keyboard help for the demos", "docs"],
];

/** What a few tasks say about themselves; the rest have no description yet. */
const BODIES: Readonly<Record<number, string>> = {
  60: "Every demo with single-key shortcuts should list them behind ?, with a switch that turns them off.\n\nMail has one already; reuse its dialog rather than writing another.",
  59: "Closing is reversible, so it should not ask. Close at once and offer Undo in a toast, as the destructive-actions guideline says.\n\nDeleting stays behind a confirmation.",
  58: "The publish workflow refuses a tag whose version does not match every package's. Write down the order: release commit, merge, push, then the tag.",
  56: "The SGR colours in a log are drawn from a fixed palette instead of the terminal theme the reader picked.",
  52: "Typing `sao` should find São Paulo. The menu already folds case; it should fold accents the same way.",
  50: "Tabbing onto an avatar opens its card, which then covers the next control. It should open on hover only.",
  45: "A long line in a code block breaks inside a word instead of at the last space.",
  42: "One retry with a short delay hides a dropped connection without hiding a server that is down. A second retry made the failure take three times as long to show.",
  41: "The notes for this release are drafted. They need a pass for wording and the migration section.",
  40: "Opening a file whose length is not a multiple of 16 shows every row but the last, partial one.\n\nSeen with a 1,000-byte file: the view ends at offset 0x3e0.",
  38: "After a failed load, Retry moves the focus to the top of the page. It should stay on the button.",
  35: "Pasting `#3b82f6` into a colour field keeps the old value. Typing it works.",
};

/** The tasks that have a story to tell, set by hand over what the index would give them. */
const SET: Readonly<Record<number, Partial<Task>>> = {
  60: { status: "todo", assignee: null, related: [59] },
  59: { status: "in-progress", assignee: "claude-agent", related: [39] },
  58: { related: [41, 16] },
  56: { related: [7] },
  52: { related: [25] },
  42: { status: "todo", assignee: "alice", related: [38] },
  41: { status: "review", assignee: "bot-one", related: [49] },
  40: { status: "todo", assignee: null, labels: ["bug"], related: [29] },
};

const PICK = ["alice", "claude-agent", null, "bot-one", "alice", "newcomer"];

/** Minutes before 2026-10-27 18:00 UTC, as an ISO string. */
const before = (minutes: number) =>
  new Date(Date.UTC(2026, 9, 27, 18, 0) - minutes * 60_000).toISOString();

/**
 * Status, assignee and the rest follow from the index alone, so every build draws the same list.
 * Most of the old work is closed; the newest is still open.
 */
function status(i: number, age: number): TaskStatus {
  if (age > 25 && i % 6 !== 3) return "closed";
  if (i % 5 === 1) return "review";
  if (i % 3 === 0) return "in-progress";
  return i % 9 === 4 ? "closed" : "todo";
}

/** Newest first, as the task list shows them. */
export const TASKS: readonly Task[] = TITLES.map(([title, label], i) => {
  const id = i + 1;
  const age = TITLES.length - id;
  const labels = [label];
  if (i % 7 === 3 && label !== "bug") labels.push("bug");
  if (i % 11 === 6) labels.push("docs");
  const related = [id - 3, id - 17].filter(
    (other, n) => other > 0 && (n === 0 ? i % 4 === 1 : i % 6 === 2),
  );
  return {
    id,
    title,
    status: status(i, age),
    assignee: PICK[(i * 7) % PICK.length] ?? null,
    labels: [...new Set(labels)],
    related,
    body: BODIES[id] ?? "",
    updated: before(age * 157 + (i % 4) * 23),
    ...SET[id],
  };
}).reverse();
