import {
  INBOX_LABELS,
  INBOX_ME,
  INBOX_PEOPLE,
  INBOX_THREADS,
  type InboxFolder,
  type InboxMessage,
  type InboxThread,
} from "@orz/fixtures/inbox.ts";
import {
  defineQuerySchema,
  parseQuery,
  queryFilters,
  queryTerms,
  type ValueProviders,
} from "@orz/query";

export {
  INBOX_LABELS,
  INBOX_ME,
  INBOX_PEOPLE,
  type InboxFolder,
  type InboxMessage,
  type InboxThread,
};

export const FOLDERS: readonly InboxFolder[] = [
  "inbox",
  "sent",
  "drafts",
  "archive",
  "trash",
];

/** What the app opens on, and what Clear goes back to. */
export const DEFAULT_QUERY = "in:inbox";

// Compiled once at module load: parsing is memoised per schema.
export const SCHEMA = defineQuerySchema({
  qualifiers: {
    in: {
      value: { kind: "enum", values: [...FOLDERS] },
      hint: "inbox, sent, drafts, archive or trash",
    },
    is: {
      value: { kind: "enum", values: ["unread", "read", "starred"] },
      hint: "unread, read or starred",
    },
    from: { value: { kind: "named", source: "person" }, hint: "a login" },
    label: { value: { kind: "named", source: "label" }, hint: "a label" },
  },
  braces: true,
});

export const PROVIDERS: ValueProviders = {
  person: {
    options: Object.entries(INBOX_PEOPLE)
      .filter(([login]) => login !== INBOX_ME)
      .map(([value, hint]) => ({ value, hint })),
  },
  label: { options: INBOX_LABELS.map((value) => ({ value })) },
};

/** What the reader changed about one thread. */
export interface ThreadChange {
  unread?: boolean;
  starred?: boolean;
  folder?: InboxFolder;
  labels?: string[];
  /** A draft thrown away, or a message whose sending was undone: in no folder at all. */
  gone?: boolean;
}

/** What the reader has changed since the page loaded: the server's side of a real inbox. */
export interface MailboxState {
  changes: Readonly<Record<string, ThreadChange>>;
  replies: Readonly<Record<string, readonly InboxMessage[]>>;
  /** Threads written here, sent or drafted, newest first. One with a fixture's id replaces it. */
  composed: readonly InboxThread[];
}

export const EMPTY_STATE: MailboxState = {
  changes: {},
  replies: {},
  composed: [],
};

/** A thread with the reader's own changes applied. */
export function current(
  thread: InboxThread,
  state: MailboxState,
): InboxThread & { gone?: boolean } {
  const replies = state.replies[thread.id] ?? [];
  return {
    ...thread,
    ...state.changes[thread.id],
    messages: replies.length
      ? [...thread.messages, ...replies]
      : thread.messages,
  };
}

/** Every thread as the reader's changes leave it, newest first, the gone ones left out. */
export function allThreads(state: MailboxState): InboxThread[] {
  const composed = new Set(state.composed.map((thread) => thread.id));
  return [
    ...state.composed,
    ...INBOX_THREADS.filter((thread) => !composed.has(thread.id)),
  ]
    .map((thread) => current(thread, state))
    .filter((thread) => !thread.gone);
}

/** A thread by its id, a gone one too, so what took it away can be undone. */
export function findThread(
  id: string,
  state: MailboxState,
): (InboxThread & { gone?: boolean }) | undefined {
  const thread =
    state.composed.find((each) => each.id === id) ??
    INBOX_THREADS.find((each) => each.id === id);
  return thread && current(thread, state);
}

export const folderOf = (thread: InboxThread): InboxFolder =>
  thread.folder ?? "inbox";

export function inFolder(thread: InboxThread, folder: InboxFolder): boolean {
  const filed = folderOf(thread);
  if (folder !== "sent") return filed === folder;
  // A thread the reader wrote in shows under Sent wherever it is filed, as long as it is kept.
  return (
    filed === "sent" ||
    (filed !== "trash" &&
      filed !== "drafts" &&
      thread.messages.some((message) => message.from === INBOX_ME))
  );
}

function matches(thread: InboxThread, query: string): boolean {
  const parts = parseQuery(SCHEMA, query);
  const filters = queryFilters(parts);
  // Without `in:` a search covers all mail, as a mail client's does, but not the bin or drafts.
  if (!filters.some(({ key }) => key === "in")) {
    const filed = folderOf(thread);
    if (filed === "trash" || filed === "drafts") return false;
  }
  for (const { key, negated, values } of filters) {
    // Values in one filter are an OR, as in `label:{ci,docs}`.
    const hit = values.some((value) => {
      if (key === "in") return inFolder(thread, value as InboxFolder);
      if (key === "is") {
        if (value === "unread") return thread.unread;
        if (value === "read") return !thread.unread;
        return thread.starred;
      }
      if (key === "from") {
        return thread.messages.some((message) => message.from === value);
      }
      return thread.labels.includes(value);
    });
    if (hit === negated) return false;
  }
  const text = [
    thread.subject,
    ...thread.messages.map((message) => message.body),
  ]
    .join("\n")
    .toLowerCase();
  return queryTerms(parts).every((term) => text.includes(term.toLowerCase()));
}

export const PAGE_SIZE = 15;

export interface Page {
  ids: string[];
  /** Where the next page starts; null at the end. */
  next: number | null;
  /** How many threads the query matches in all. */
  total: number;
}

/** One page of the threads `query` matches, newest first. */
export function searchThreads(
  query: string,
  state: MailboxState,
  offset = 0,
): Page {
  const hits = allThreads(state).filter((thread) => matches(thread, query));
  const end = offset + PAGE_SIZE;
  return {
    ids: hits.slice(offset, end).map((thread) => thread.id),
    next: end < hits.length ? end : null,
    total: hits.length,
  };
}

/** How long a page takes to arrive: long enough to see the button say so. */
export const LATENCY_MS = 600;

/** `searchThreads` as a server answers it, after a round trip. */
export function fetchThreads(
  query: string,
  state: MailboxState,
  offset: number,
): Promise<Page> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(searchThreads(query, state, offset)), LATENCY_MS),
  );
}

let refreshes = 0;

/**
 * A check for new mail, after a round trip. The demo's server turns the first one away, so the
 * failure and its Retry are there to be seen; every one after it goes through.
 */
export function checkMail(): Promise<void> {
  refreshes += 1;
  const fails = refreshes === 1;
  return new Promise((resolve, reject) =>
    setTimeout(
      () => (fails ? reject(new Error("503 Service Unavailable")) : resolve()),
      LATENCY_MS,
    ),
  );
}

/** How many unread threads a folder holds. */
export const unreadIn = (folder: InboxFolder, state: MailboxState) =>
  allThreads(state).filter(
    (thread) => thread.unread && inFolder(thread, folder),
  ).length;

export const draftCount = (state: MailboxState) =>
  allThreads(state).filter((thread) => folderOf(thread) === "drafts").length;

/**
 * `patch` applied to every thread in `ids`, and the function that takes it back. The undo
 * restores only what the patch touched, so whatever else the reader did meanwhile stays.
 */
export function changeThreads(
  state: MailboxState,
  ids: readonly string[],
  patch: ThreadChange,
): [MailboxState, (state: MailboxState) => MailboxState] {
  const before = Object.fromEntries(
    ids.map((id) => [id, state.changes[id]] as const),
  );
  const changes = { ...state.changes };
  for (const id of ids) changes[id] = { ...changes[id], ...patch };
  const undo = (later: MailboxState): MailboxState => {
    const restored = { ...later.changes };
    for (const id of ids) {
      const was = before[id];
      const now = { ...restored[id] };
      for (const key of Object.keys(patch) as (keyof ThreadChange)[]) {
        if (was && key in was) Object.assign(now, { [key]: was[key] });
        else delete now[key];
      }
      restored[id] = now;
    }
    return { ...later, changes: restored };
  };
  return [{ ...state, changes }, undo];
}

/** A message being written: what the compose window holds. */
export interface Draft {
  /** The thread it is saved as; a new one's id is made when it is opened. */
  id: string;
  to: string;
  subject: string;
  body: string;
}

let drafted = 0;
export const newDraft = (): Draft => ({
  id: `composed-${++drafted}`,
  to: "",
  subject: "",
  body: "",
});

/** The logins in a To field, in the order written. */
export const recipientsOf = (to: string) =>
  to
    .split(/[\s,;]+/)
    .map((login) => login.replace(/^@/, ""))
    .filter(Boolean);

/** The draft a saved thread holds, to open it in the compose window again. */
export function draftOf(thread: InboxThread): Draft {
  const message = thread.messages.at(-1);
  return {
    id: thread.id,
    to: message?.to?.join(", ") ?? "",
    subject: thread.subject,
    body: message?.body ?? "",
  };
}

/** `draft` filed in `folder`: saved to Drafts, or sent. */
export function fileDraft(
  state: MailboxState,
  draft: Draft,
  folder: "drafts" | "sent",
): MailboxState {
  const thread: InboxThread = {
    id: draft.id,
    subject: draft.subject.trim() || "(no subject)",
    labels: [],
    unread: false,
    starred: false,
    folder,
    messages: [
      {
        from: INBOX_ME,
        to: recipientsOf(draft.to),
        at: new Date().toISOString(),
        body: draft.body,
      },
    ],
  };
  const { [draft.id]: _, ...changes } = state.changes;
  return {
    ...state,
    changes,
    composed: [
      thread,
      ...state.composed.filter((each) => each.id !== draft.id),
    ],
  };
}

export const hasWords = (draft: Draft) =>
  [draft.to, draft.subject, draft.body].some((field) => field.trim() !== "");
