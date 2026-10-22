import { describe, expect, it, vi } from "vitest";

import { createPageCache } from "../src/page-cache.ts";
import { type ByteSource, blobSource, bytesSource } from "../src/source.ts";

interface Call {
  offset: number;
  length: number;
  signal?: AbortSignal;
  resolve: () => void;
  reject: (error: unknown) => void;
}

function fakeSource(size: number) {
  const calls: Call[] = [];
  let onChange: (() => void) | undefined;
  const source: ByteSource = {
    size,
    read(offset, length, signal) {
      return new Promise<Uint8Array>((resolve, reject) => {
        calls.push({
          offset,
          length,
          signal,
          resolve: () =>
            resolve(Uint8Array.from({ length }, (_, i) => (offset + i) & 0xff)),
          reject,
        });
      });
    },
    subscribe(listener) {
      onChange = listener;
      return () => {
        onChange = undefined;
      };
    },
  };
  return { source, calls, change: () => onChange?.() };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createPageCache", () => {
  it("aligns pages and reads a short final page", async () => {
    const { source, calls } = fakeSource(250);
    const cache = createPageCache(source, { pageSize: 100 });
    cache.request(0, 5);
    expect(calls.map((c) => [c.offset, c.length])).toEqual([
      [0, 100],
      [100, 100],
      [200, 50],
    ]);
    for (const call of calls) call.resolve();
    await flush();
    expect(cache.get(95, 10)).toEqual(
      Uint8Array.from({ length: 10 }, (_, i) => 95 + i),
    );
    expect(cache.get(240, 50)?.length).toBe(10);
    expect(cache.status(2)).toBe("ready");
  });

  it("shares one read between two requests for a page", async () => {
    const { source, calls } = fakeSource(1000);
    const cache = createPageCache(source, { pageSize: 100 });
    cache.request(1, 1);
    cache.request(1, 1);
    expect(cache.get(150, 4)).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(cache.status(1)).toBe("loading");
    expect(cache.pending()).toBe(true);
    calls[0]?.resolve();
    await flush();
    expect(cache.pending()).toBe(false);
    cache.request(1, 1);
    expect(calls).toHaveLength(1);
  });

  it("evicts the least recently used page", async () => {
    const { source, calls } = fakeSource(1000);
    const cache = createPageCache(source, { pageSize: 100, maxPages: 2 });
    cache.request(0, 1);
    for (const call of calls) call.resolve();
    await flush();
    cache.get(0, 1); // page 0 becomes the most recent
    cache.request(2, 2);
    calls[2]?.resolve();
    await flush();
    expect(cache.status(0)).toBe("ready");
    expect(cache.status(1)).toBe("idle");
    expect(cache.status(2)).toBe("ready");
  });

  it("aborts pages outside the retained range plus one", async () => {
    const { source, calls } = fakeSource(1000);
    const cache = createPageCache(source, { pageSize: 100 });
    cache.request(0, 0);
    cache.request(5, 5);
    cache.retain(4, 6);
    expect(calls[0]?.signal?.aborted).toBe(true);
    expect(calls[1]?.signal?.aborted).toBe(false);
    expect(cache.status(0)).toBe("idle");
    calls[0]?.resolve();
    await flush();
    expect(cache.status(0)).toBe("idle");
  });

  it("does not cache a failed read and retries it on the next request", async () => {
    const { source, calls } = fakeSource(1000);
    const onError = vi.fn();
    const cache = createPageCache(source, { pageSize: 100, onError });
    cache.request(3, 3);
    const error = new Error("boom");
    calls[0]?.reject(error);
    await flush();
    expect(cache.status(3)).toBe("error");
    expect(onError).toHaveBeenCalledWith(error, 300);
    cache.request(3, 3);
    expect(calls).toHaveLength(2);
    expect(cache.status(3)).toBe("loading");
  });

  it("drops its data on invalidate and on a source change", async () => {
    const { source, calls, change } = fakeSource(1000);
    const cache = createPageCache(source, { pageSize: 100 });
    const listener = vi.fn();
    cache.subscribe(listener);
    cache.request(0, 0);
    calls[0]?.resolve();
    await flush();
    expect(cache.status(0)).toBe("ready");
    const before = cache.version();
    change();
    expect(cache.version()).not.toBe(before);
    expect(listener).toHaveBeenCalled();
    // The visible page is asked for again straight away.
    expect(calls).toHaveLength(2);
    expect(cache.status(0)).toBe("loading");
    cache.invalidate();
    expect(calls[1]?.signal?.aborted).toBe(true);
  });

  it("passes sync sources straight through without caching", () => {
    const bytes = Uint8Array.from({ length: 300 }, (_, i) => i & 0xff);
    const read = vi.fn(bytesSource(bytes).read);
    const cache = createPageCache({ size: 300, read }, { pageSize: 100 });
    const got = cache.get(90, 20);
    expect(got).toEqual(bytes.subarray(90, 110));
    expect(got?.buffer).toBe(bytes.buffer);
    cache.request(0, 2);
    expect(cache.status(1)).toBe("ready");
    expect(cache.pending()).toBe(false);
    const calls = read.mock.calls.length;
    cache.get(0, 10);
    expect(read.mock.calls.length).toBe(calls + 1);
  });

  it("notifies when retain aborts what was loading", () => {
    const { source } = fakeSource(1000);
    const cache = createPageCache(source, { pageSize: 100 });
    const listener = vi.fn();
    cache.subscribe(listener);
    cache.request(0, 0);
    cache.retain(5, 5);
    expect(cache.pending()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("switches to paging when a sync source starts answering with promises", () => {
    let async = false;
    const bytes = new Uint8Array(300);
    const source: ByteSource = {
      size: 300,
      read: (offset, length) =>
        async
          ? Promise.resolve(bytes.slice(offset, offset + length))
          : bytes.subarray(offset, offset + length),
    };
    const cache = createPageCache(source, { pageSize: 100 });
    expect(cache.get(0, 10)).toBeInstanceOf(Uint8Array);
    async = true;
    expect(cache.get(0, 10)).toBeUndefined();
    expect(cache.status(0)).toBe("idle");
  });

  it("serves an uncached range from the source's peek without reading it", async () => {
    const { source, calls } = fakeSource(1000);
    const peeked = Uint8Array.of(1, 2, 3);
    const peek = vi.fn((offset: number, length: number) =>
      offset === 150 && length === 3 ? peeked : undefined,
    );
    const cache = createPageCache({ ...source, peek }, { pageSize: 100 });
    cache.request(0, 0);
    calls[0]?.resolve();
    await flush();
    expect(cache.get(150, 3)).toBe(peeked);
    expect(cache.get(250, 3)).toBeUndefined();
    expect(calls).toHaveLength(1);
  });

  it("shares one load between two callers", async () => {
    const { source, calls } = fakeSource(1000);
    const cache = createPageCache(source, { pageSize: 100 });
    const a = cache.load(2);
    const b = cache.load(2);
    expect(calls).toHaveLength(1);
    calls[0]?.resolve();
    const [bytesA, bytesB] = await Promise.all([a, b]);
    expect(bytesA).toBe(bytesB);
    expect(bytesA[0]).toBe(200);
    expect(cache.status(2)).toBe("ready");
    await cache.load(2);
    expect(calls).toHaveLength(1);
  });

  it("keeps a load going while one of its callers still waits", async () => {
    const { source, calls } = fakeSource(1000);
    const cache = createPageCache(source, { pageSize: 100 });
    const controller = new AbortController();
    const aborted = cache.load(2, controller.signal);
    const kept = cache.load(2);
    controller.abort();
    await expect(aborted).rejects.toBeDefined();
    expect(calls[0]?.signal?.aborted).toBe(false);
    calls[0]?.resolve();
    expect((await kept)[0]).toBe(200);
  });

  it("aborts the read once every caller has aborted", async () => {
    const { source, calls } = fakeSource(1000);
    const cache = createPageCache(source, { pageSize: 100 });
    const one = new AbortController();
    const two = new AbortController();
    const a = cache.load(2, one.signal);
    const b = cache.load(2, two.signal);
    one.abort();
    expect(calls[0]?.signal?.aborted).toBe(false);
    two.abort();
    expect(calls[0]?.signal?.aborted).toBe(true);
    await expect(a).rejects.toBeDefined();
    await expect(b).rejects.toBeDefined();
    expect(cache.pending()).toBe(false);
  });

  it("makes one read for a page both loaded and requested", async () => {
    const { source, calls } = fakeSource(1000);
    const cache = createPageCache(source, { pageSize: 100 });
    cache.request(3, 3);
    const loaded = cache.load(3);
    cache.request(3, 3);
    expect(calls).toHaveLength(1);
    calls[0]?.resolve();
    expect((await loaded)[0]).toBe(44);
  });

  it("lets a caller of an invalidated load abort without touching the newer read", async () => {
    const { source, calls } = fakeSource(1000);
    const cache = createPageCache(source, { pageSize: 100 });
    const stale = new AbortController();
    const first = cache.load(0, stale.signal);
    first.catch(() => {});
    cache.invalidate();
    const second = cache.load(0, new AbortController().signal);
    stale.abort();
    expect(calls[1]?.signal?.aborted).toBe(false);
    calls[1]?.resolve();
    expect((await second)[0]).toBe(0);
  });

  it("aborts a load once its caller gives up after the last view left", async () => {
    const { source, calls } = fakeSource(1000);
    const cache = createPageCache(source, { pageSize: 100 });
    const unsubscribe = cache.subscribe(() => {});
    cache.request(0, 0);
    const controller = new AbortController();
    cache.load(0, controller.signal).catch(() => {});
    unsubscribe();
    expect(calls[0]?.signal?.aborted).toBe(false);
    controller.abort();
    expect(calls[0]?.signal?.aborted).toBe(true);
  });

  it("rejects a load whose read fails and marks the page failed", async () => {
    const { source, calls } = fakeSource(1000);
    const cache = createPageCache(source, { pageSize: 100 });
    const loaded = cache.load(1);
    calls[0]?.reject(new Error("boom"));
    await expect(loaded).rejects.toThrow("boom");
    expect(cache.status(1)).toBe("error");
  });
});

describe("byte sources", () => {
  it("expose what they wrap", () => {
    const bytes = new Uint8Array(4);
    const blob = new Blob([bytes]);
    expect(bytesSource(bytes).bytes).toBe(bytes);
    expect(blobSource(blob).blob).toBe(blob);
  });
});
