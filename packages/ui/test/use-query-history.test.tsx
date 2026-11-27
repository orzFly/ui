import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type QueryHistory,
  type QueryHistoryEntry,
  useQueryHistory,
} from "../src/hooks/use-query-history.ts";

const KEY = "app:search-history:v1:user";
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 27, 12);

const stored = (): Record<string, QueryHistoryEntry[]> | null => {
  const raw = localStorage.getItem(KEY);
  return raw === null ? null : JSON.parse(raw);
};
const store = (value: unknown) =>
  localStorage.setItem(KEY, JSON.stringify(value));

/**
 * Storage with some methods replaced. Spying on `Storage.prototype` misses
 * happy-dom's `localStorage`, which answers through a proxy of its own.
 */
const replaceStorage = (methods: Partial<Storage>) => {
  const real = localStorage;
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => real.getItem(key),
    setItem: (key: string, value: string) => real.setItem(key, value),
    removeItem: (key: string) => real.removeItem(key),
    ...methods,
  });
};
const refuse = (name: string) => () => {
  throw new DOMException("refused", name);
};

const mount = (scope = "alpha", storageKey = KEY) =>
  renderHook(({ scope }) => useQueryHistory({ storageKey, scope }), {
    initialProps: { scope },
  });

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("useQueryHistory · reading", () => {
  it("reads an existing history of the same shape as it stands", () => {
    // The shape an app already keeps: buckets per scope, newest first.
    store({
      alpha: [
        { q: "label:kind:bug is:open", t: NOW - 1000 },
        { q: "flaky test", t: NOW - DAY },
      ],
      beta: [{ q: "assignee:@me", t: NOW - 2 * DAY }],
    });
    expect(mount("alpha").result.current.entries).toEqual([
      { q: "label:kind:bug is:open", t: NOW - 1000 },
      { q: "flaky test", t: NOW - DAY },
    ]);
    expect(mount("beta").result.current.entries).toEqual([
      { q: "assignee:@me", t: NOW - 2 * DAY },
    ]);
    expect(mount("gamma").result.current.entries).toEqual([]);
  });

  it("gives nothing older than 90 days, before any write", () => {
    store({
      alpha: [
        { q: "recent", t: NOW - 89 * DAY },
        { q: "old", t: NOW - 91 * DAY },
      ],
    });
    expect(mount().result.current.entries.map((e) => e.q)).toEqual(["recent"]);
    // Reading alone writes nothing.
    expect(stored()?.alpha).toHaveLength(2);
  });

  it.each([
    ["not JSON", "{not json"],
    ["an array", "[]"],
    ["a string", '"alpha"'],
    ["null", "null"],
  ])("takes %s as no history", (_, raw) => {
    localStorage.setItem(KEY, raw);
    expect(mount().result.current.entries).toEqual([]);
  });

  it("skips a bucket that is no list, and drops only the malformed entries", () => {
    store({
      alpha: [
        { q: "kept", t: NOW },
        { q: 3, t: NOW },
        { q: "no time" },
        { t: NOW },
        null,
        "loose",
        { q: "also kept", t: NOW - 1 },
      ],
      beta: { q: "not a list", t: NOW },
    });
    expect(mount("alpha").result.current.entries.map((e) => e.q)).toEqual([
      "kept",
      "also kept",
    ]);
    expect(mount("beta").result.current.entries).toEqual([]);
    // An inherited name is no bucket.
    expect(mount("constructor").result.current.entries).toEqual([]);
  });

  it("has no history when storage cannot be read", () => {
    store({ alpha: [{ q: "kept", t: NOW }] });
    replaceStorage({ getItem: refuse("SecurityError") });
    const view = mount();
    expect(view.result.current.entries).toEqual([]);
    expect(() => act(() => view.result.current.record("new"))).not.toThrow();
    expect(() => act(() => view.result.current.remove("kept"))).not.toThrow();
  });

  it("has no history on the server, whatever storage holds", () => {
    store({ alpha: [{ q: "kept", t: NOW }] });
    function Probe() {
      const history = useQueryHistory({ storageKey: KEY, scope: "alpha" });
      return <span>{history.entries.length}</span>;
    }
    expect(renderToString(<Probe />)).toBe("<span>0</span>");
  });
});

describe("useQueryHistory · record", () => {
  it("puts the query first, trimmed, now", () => {
    const view = mount();
    act(() => view.result.current.record("  flaky test "));
    vi.setSystemTime(NOW + 1000);
    act(() => view.result.current.record("is:open"));
    expect(view.result.current.entries).toEqual([
      { q: "is:open", t: NOW + 1000 },
      { q: "flaky test", t: NOW },
    ]);
    expect(stored()).toEqual({ alpha: view.result.current.entries });
  });

  it("keeps one entry per query whatever its case, spelled as last searched", () => {
    const view = mount();
    act(() => view.result.current.record("Flaky Test"));
    act(() => view.result.current.record("is:open"));
    vi.setSystemTime(NOW + 1000);
    act(() => view.result.current.record("flaky test"));
    expect(view.result.current.entries).toEqual([
      { q: "flaky test", t: NOW + 1000 },
      { q: "is:open", t: NOW },
    ]);
  });

  it("ignores an empty query", () => {
    const view = mount();
    act(() => view.result.current.record(""));
    act(() => view.result.current.record("   "));
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("keeps 25 per scope, dropping the oldest", () => {
    const view = mount();
    for (let i = 0; i < 30; i++) {
      vi.setSystemTime(NOW + i);
      act(() => view.result.current.record(`query ${i}`));
    }
    const entries = view.result.current.entries;
    expect(entries).toHaveLength(25);
    expect(entries[0]?.q).toBe("query 29");
    expect(entries.at(-1)?.q).toBe("query 5");
  });

  it("sweeps expired entries from every scope, and the scopes they empty", () => {
    store({
      alpha: [{ q: "old here", t: NOW - 91 * DAY }],
      beta: [
        { q: "fresh there", t: NOW - DAY },
        { q: "old there", t: NOW - 100 * DAY },
      ],
      gone: [{ q: "old elsewhere", t: NOW - 95 * DAY }],
    });
    const view = mount("alpha");
    act(() => view.result.current.record("new"));
    expect(stored()).toEqual({
      alpha: [{ q: "new", t: NOW }],
      beta: [{ q: "fresh there", t: NOW - DAY }],
    });
  });

  it("keeps a scope named after an object's own properties as a bucket", () => {
    const view = mount("__proto__");
    act(() => view.result.current.record("odd"));
    expect(Object.keys(stored() ?? {})).toEqual(["__proto__"]);
    expect(view.result.current.entries.map((e) => e.q)).toEqual(["odd"]);
  });

  it("writes nothing and throws nothing when storage refuses", () => {
    const view = mount();
    replaceStorage({ setItem: refuse("QuotaExceededError") });
    expect(() => act(() => view.result.current.record("new"))).not.toThrow();
    expect(view.result.current.entries).toEqual([]);
  });
});

describe("useQueryHistory · remove", () => {
  it("drops a query whatever its case, leaving the others", () => {
    store({
      alpha: [
        { q: "Flaky Test", t: NOW },
        { q: "is:open", t: NOW - 1 },
      ],
      beta: [{ q: "flaky test", t: NOW }],
    });
    const view = mount();
    act(() => view.result.current.remove("flaky test"));
    expect(view.result.current.entries.map((e) => e.q)).toEqual(["is:open"]);
    expect(stored()?.beta).toEqual([{ q: "flaky test", t: NOW }]);
  });

  it("deletes a scope it empties, and the key once nothing is left", () => {
    store({
      alpha: [{ q: "only", t: NOW }],
      beta: [{ q: "there", t: NOW }],
    });
    const view = mount();
    act(() => view.result.current.remove("only"));
    expect(stored()).toEqual({ beta: [{ q: "there", t: NOW }] });
    view.rerender({ scope: "beta" });
    act(() => view.result.current.remove("there"));
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("writes nothing for a query it does not hold", () => {
    store({ alpha: [{ q: "kept", t: NOW }] });
    const set = vi.fn();
    replaceStorage({ setItem: set, removeItem: set });
    const view = mount();
    act(() => view.result.current.remove("missing"));
    expect(set).not.toHaveBeenCalled();
  });

  it("throws nothing when storage refuses", () => {
    store({ alpha: [{ q: "kept", t: NOW }] });
    const view = mount();
    replaceStorage({ setItem: refuse("QuotaExceededError") });
    expect(() => act(() => view.result.current.remove("kept"))).not.toThrow();
  });
});

describe("useQueryHistory · following changes", () => {
  it("re-renders another hook on the same key when this page writes", () => {
    const one = mount();
    const two = mount();
    act(() => one.result.current.record("from one"));
    expect(two.result.current.entries.map((e) => e.q)).toEqual(["from one"]);
    act(() => two.result.current.remove("from one"));
    expect(one.result.current.entries).toEqual([]);
  });

  it("follows another tab through the storage event", () => {
    const view = mount();
    act(() => {
      store({ alpha: [{ q: "from another tab", t: NOW }] });
      window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    });
    expect(view.result.current.entries.map((e) => e.q)).toEqual([
      "from another tab",
    ]);
  });

  it("keeps record and remove the same across renders", () => {
    const view = mount();
    const first: QueryHistory = view.result.current;
    act(() => first.record("something"));
    expect(view.result.current.record).toBe(first.record);
    expect(view.result.current.remove).toBe(first.remove);
  });

  it("stops listening once the last hook unmounts", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const one = mount();
    const two = mount();
    one.unmount();
    expect(remove).not.toHaveBeenCalledWith("storage", expect.anything());
    two.unmount();
    expect(remove).toHaveBeenCalledWith("storage", expect.anything());
  });
});
