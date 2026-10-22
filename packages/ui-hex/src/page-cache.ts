import type { ByteSource } from "./source.ts";

export type PageStatus = "ready" | "loading" | "error" | "idle";

export interface PageCacheOptions {
  pageSize?: number;
  maxPages?: number;
  onError?: (error: unknown, offset: number) => void;
}

export interface PageCache {
  readonly pageSize: number;
  /** The bytes, when every covering page is available synchronously; otherwise `undefined`. */
  get(offset: number, length: number): Uint8Array | undefined;
  /** Makes sure these pages are loading; pages already in flight are shared. */
  request(firstPage: number, lastPage: number): void;
  /** Aborts in-flight pages outside the range widened by one page. */
  retain(firstPage: number, lastPage: number): void;
  status(page: number): PageStatus;
  /** True while any page is in flight. */
  pending(): boolean;
  subscribe(listener: () => void): () => void;
  /** Changes whenever what `get` or `status` return may have changed. */
  version(): number;
  invalidate(): void;
  /** The whole range, bypassing the cache; used by copy. */
  readRange(
    offset: number,
    length: number,
    signal?: AbortSignal,
  ): Promise<Uint8Array>;
}

interface Flight {
  controller: AbortController;
}

export function createPageCache(
  source: ByteSource,
  { pageSize = 65536, maxPages = 256, onError }: PageCacheOptions = {},
): PageCache {
  // Unknown until the first read: a source that returns a Uint8Array rather
  // than a promise is in memory, and caching it would only copy it.
  let sync: boolean | undefined;
  const pages = new Map<number, Uint8Array>();
  const flights = new Map<number, Flight>();
  const errors = new Set<number>();
  const listeners = new Set<() => void>();
  let wanted: [number, number] | undefined;
  let ver = 0;
  let unsubscribeSource: (() => void) | undefined;

  const notify = () => {
    ver++;
    for (const listener of listeners) listener();
  };

  const pageCount = () => Math.ceil(source.size / pageSize);

  // A read can run during render (a probe from `get`), so the error report
  // waits for a microtask instead of calling into the app from there.
  const fail = (page: number, error: unknown) => {
    errors.add(page);
    queueMicrotask(() => {
      onError?.(error, page * pageSize);
      notify();
    });
  };

  /** Reads `page`; a sync source's bytes come back at once and are not stored. */
  const load = (page: number): Uint8Array | undefined => {
    const start = page * pageSize;
    const length = Math.min(pageSize, source.size - start);
    if (length <= 0) return undefined;
    const controller = new AbortController();
    let result: Uint8Array | Promise<Uint8Array>;
    try {
      result = source.read(start, length, controller.signal);
    } catch (error) {
      fail(page, error);
      return undefined;
    }
    if (result instanceof Uint8Array) {
      sync = true;
      errors.delete(page);
      return result;
    }
    sync = false;
    const flight: Flight = { controller };
    flights.set(page, flight);
    errors.delete(page);
    result.then(
      (bytes) => {
        if (flights.get(page) !== flight) return;
        flights.delete(page);
        pages.set(page, bytes);
        while (pages.size > maxPages) {
          pages.delete(pages.keys().next().value as number);
        }
        notify();
      },
      (error: unknown) => {
        if (flights.get(page) !== flight) return;
        flights.delete(page);
        fail(page, error);
      },
    );
    return undefined;
  };

  /** A direct read from a source that has answered synchronously so far. */
  const readSync = (offset: number, length: number): Uint8Array | undefined => {
    const page = Math.floor(offset / pageSize);
    if (errors.has(page)) return undefined;
    let result: Uint8Array | Promise<Uint8Array>;
    try {
      result = source.read(offset, length);
    } catch (error) {
      fail(page, error);
      return undefined;
    }
    if (result instanceof Uint8Array) return result;
    // A source may answer from memory for some ranges and asynchronously for
    // others (an edited document over a remote file); from here on it pages.
    result.catch(() => {});
    sync = false;
    return undefined;
  };

  const cachedPage = (page: number): Uint8Array | undefined => {
    const bytes = pages.get(page);
    if (bytes) {
      pages.delete(page);
      pages.set(page, bytes);
    }
    return bytes;
  };

  const abort = (page: number) => {
    const flight = flights.get(page);
    if (!flight) return;
    flights.delete(page);
    flight.controller.abort();
  };

  const cache: PageCache = {
    pageSize,

    get(offset, length) {
      const end = Math.min(offset + length, source.size);
      if (end <= offset) return new Uint8Array(0);
      const first = Math.floor(offset / pageSize);
      const last = Math.floor((end - 1) / pageSize);
      if (sync === undefined && !flights.has(first) && !errors.has(first)) {
        load(first);
      }
      if (sync) {
        const bytes = readSync(offset, end - offset);
        if (bytes || sync) return bytes;
      }
      if (first === last) {
        const bytes = cachedPage(first);
        if (!bytes) return undefined;
        const at = offset - first * pageSize;
        return bytes.subarray(at, at + end - offset);
      }
      const out = new Uint8Array(end - offset);
      for (let page = first; page <= last; page++) {
        const bytes = cachedPage(page);
        if (!bytes) return undefined;
        const pageStart = page * pageSize;
        const from = Math.max(offset, pageStart) - pageStart;
        const to = Math.min(end, pageStart + bytes.length) - pageStart;
        out.set(bytes.subarray(from, to), pageStart + from - offset);
      }
      return out;
    },

    request(firstPage, lastPage) {
      wanted = [firstPage, lastPage];
      const last = Math.min(lastPage, pageCount() - 1);
      let retried = false;
      for (let page = Math.max(0, firstPage); page <= last; page++) {
        if (sync) {
          // Nothing to load, but a failed range is tried again once it
          // comes back into view.
          retried = errors.delete(page) || retried;
          continue;
        }
        if (pages.has(page) || flights.has(page)) continue;
        load(page);
      }
      if (retried) notify();
    },

    retain(firstPage, lastPage) {
      let aborted = false;
      for (const page of [...flights.keys()]) {
        if (page < firstPage - 1 || page > lastPage + 1) {
          abort(page);
          aborted = true;
        }
      }
      // pending() may have just turned false with nothing left to load.
      if (aborted) notify();
    },

    status(page) {
      if (pages.has(page)) return "ready";
      if (flights.has(page)) return "loading";
      if (errors.has(page)) return "error";
      return sync ? "ready" : "idle";
    },

    pending: () => flights.size > 0,

    // The source is watched only while someone watches the cache, so a cache
    // dropped by an unmounted view leaves no listener behind on the source.
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        unsubscribeSource = source.subscribe?.(() => cache.invalidate());
      }
      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) return;
        unsubscribeSource?.();
        unsubscribeSource = undefined;
        for (const page of [...flights.keys()]) abort(page);
      };
    },

    version: () => ver,

    invalidate() {
      for (const page of [...flights.keys()]) abort(page);
      pages.clear();
      errors.clear();
      if (wanted) cache.request(wanted[0], wanted[1]);
      notify();
    },

    async readRange(offset, length, signal) {
      return source.read(offset, length, signal);
    },
  };
  return cache;
}
