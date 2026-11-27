import { useCallback, useMemo, useSyncExternalStore } from "react";

/** One past query and when it was last searched, in ms since the epoch. */
export type QueryHistoryEntry = { q: string; t: number };

export type QueryHistory = {
  /** This scope's past queries, newest first; none older than 90 days. */
  entries: readonly QueryHistoryEntry[];
  /** Puts a query that was searched first in its scope; an empty one is ignored. */
  record: (query: string) => void;
  /** Drops a query from its scope, whatever its case. */
  remove: (query: string) => void;
};

const PER_SCOPE = 25;
const MAX_AGE = 90 * 24 * 60 * 60 * 1000;

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", notify);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", notify);
  };
}

/**
 * The raw string, not what it parses to: `useSyncExternalStore` compares
 * snapshots by identity, and a freshly parsed object would never equal the
 * last one, re-rendering forever.
 */
function read(storageKey: string): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

/** Every scope's bucket as stored, unchecked; `{}` for anything but an object. */
function parse(raw: string | null): Record<string, unknown> {
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** A bucket's well-formed entries; a bucket that is not a list has none. */
function bucket(store: Record<string, unknown>, scope: string) {
  const value = Object.hasOwn(store, scope) ? store[scope] : undefined;
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is QueryHistoryEntry =>
      typeof entry === "object" &&
      entry !== null &&
      typeof entry.q === "string" &&
      typeof entry.t === "number",
  );
}

function fresh(entry: QueryHistoryEntry, now: number): boolean {
  return now - entry.t <= MAX_AGE;
}

// A Map, not an object: a scope named `__proto__` assigned onto an object
// would set its prototype instead of a bucket.
function write(storageKey: string, store: Map<string, unknown>) {
  if (store.size === 0) localStorage.removeItem(storageKey);
  else
    localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(store)));
  // The `storage` event only reaches other tabs; without this the row just
  // removed from this tab's panel would stay on screen.
  notify();
}

/**
 * Past queries kept in localStorage, one bucket per scope, following other tabs.
 * Hand the result to a QueryBox as `history`, and `record` a query where the app
 * really searched it. At most 25 per scope, none older than 90 days; the same
 * query in another case is one entry, spelled as it was last searched.
 */
export function useQueryHistory({
  storageKey,
  scope,
}: {
  /** localStorage key holding every scope's history. Name it after the app; there is no default. */
  storageKey: string;
  /** The bucket this box's queries go in: whatever a query's meaning depends on (a project). */
  scope: string;
}): QueryHistory {
  // Null on the server and while hydrating, so the first client render
  // matches the prerendered page; the stored history follows right after.
  const raw = useSyncExternalStore(
    subscribe,
    () => read(storageKey),
    () => null,
  );

  const entries = useMemo(() => {
    const now = Date.now();
    return bucket(parse(raw), scope).filter((entry) => fresh(entry, now));
  }, [raw, scope]);

  // Storage that throws (private mode, a full quota, storage turned off)
  // leaves the box without a history and nothing else: a list of past
  // searches is not worth breaking a page or filling a console over.
  const record = useCallback(
    (query: string) => {
      const q = query.trim();
      if (q === "") return;
      try {
        const now = Date.now();
        const needle = q.toLowerCase();
        const next = new Map<string, QueryHistoryEntry[]>();
        const store = parse(read(storageKey));
        // Expired entries go from every scope, and a scope left empty with
        // them, so a project that is gone stops taking room.
        for (const key of Object.keys(store)) {
          const kept = bucket(store, key).filter(
            (entry) =>
              fresh(entry, now) &&
              (key !== scope || entry.q.toLowerCase() !== needle),
          );
          if (kept.length > 0) next.set(key, kept);
        }
        next.set(
          scope,
          [{ q, t: now }, ...(next.get(scope) ?? [])].slice(0, PER_SCOPE),
        );
        write(storageKey, next);
      } catch {
        // see above
      }
    },
    [storageKey, scope],
  );

  const remove = useCallback(
    (query: string) => {
      try {
        const needle = query.trim().toLowerCase();
        const store = parse(read(storageKey));
        const before = bucket(store, scope);
        const kept = before.filter((entry) => entry.q.toLowerCase() !== needle);
        if (kept.length === before.length) return;
        const next = new Map(Object.entries(store));
        if (kept.length > 0) next.set(scope, kept);
        else next.delete(scope);
        write(storageKey, next);
      } catch {
        // see `record`
      }
    },
    [storageKey, scope],
  );

  return useMemo(
    () => ({ entries, record, remove }),
    [entries, record, remove],
  );
}
