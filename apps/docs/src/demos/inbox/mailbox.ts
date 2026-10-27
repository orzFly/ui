import {
  INBOX_LABELS,
  INBOX_PEOPLE,
  INBOX_THREADS,
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

export { INBOX_PEOPLE, type InboxMessage, type InboxThread };

// Compiled once at module load: parsing is memoised per schema.
export const SCHEMA = defineQuerySchema({
  qualifiers: {
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
      .filter(([login]) => login !== "user")
      .map(([value, hint]) => ({ value, hint })),
  },
  label: { options: INBOX_LABELS.map((value) => ({ value })) },
};

/** What the reader has changed since the page loaded: the server's side of a real inbox. */
export interface MailboxState {
  read: ReadonlySet<string>;
  replies: Readonly<Record<string, readonly InboxMessage[]>>;
}

export const EMPTY_STATE: MailboxState = { read: new Set(), replies: {} };

/** A thread with the reader's own changes applied. */
export function current(thread: InboxThread, state: MailboxState): InboxThread {
  const replies = state.replies[thread.id] ?? [];
  return {
    ...thread,
    unread: thread.unread && !state.read.has(thread.id),
    messages: replies.length
      ? [...thread.messages, ...replies]
      : thread.messages,
  };
}

function matches(thread: InboxThread, query: string): boolean {
  const parts = parseQuery(SCHEMA, query);
  for (const { key, negated, values } of queryFilters(parts)) {
    // Values in one filter are an OR, as in `label:{ci,docs}`.
    const hit = values.some((value) => {
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
}

/** One page of the threads `query` matches, newest first. */
export function searchThreads(
  query: string,
  state: MailboxState,
  offset = 0,
): Page {
  const hits = INBOX_THREADS.map((thread) => current(thread, state)).filter(
    (thread) => matches(thread, query),
  );
  const end = offset + PAGE_SIZE;
  return {
    ids: hits.slice(offset, end).map((thread) => thread.id),
    next: end < hits.length ? end : null,
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

export const threadById = new Map(
  INBOX_THREADS.map((thread) => [thread.id, thread]),
);
