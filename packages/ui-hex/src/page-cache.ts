import type { ByteSource } from "./source.ts";

export type PageStatus = "ready" | "loading" | "error" | "idle";

export interface PageCacheOptions {
  pageSize?: number;
  maxPages?: number;
  onError?: (error: unknown, offset: number) => void;
}

export interface PageCache {
  readonly pageSize: number;
  /**
   * The bytes, when every covering page is available synchronously or the
   * source can `peek` them; otherwise `undefined`.
   */
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
  /**
   * One page's bytes, stored like a requested page. Callers of one page share
   * a read with each other and with `request`; `signal` ends only its own
   * caller's wait, and the read is aborted once every caller has given up.
   */
  load(page: number, signal?: AbortSignal): Promise<Uint8Array>;
  /**
   * The range, like the source's own `read`: in place while the source
   * answers synchronously, else assembled from cached pages. The first call
   * learns which by loading the range's first page, so an async source's
   * first read is cached like any other.
   */
  read(
    offset: number,
    length: number,
    signal?: AbortSignal,
  ): Uint8Array | Promise<Uint8Array>;
  /** Whether the source has answered synchronously so far; `undefined` before its first read. */
  sync(): boolean | undefined;
  /** The whole range, bypassing the cache; used by copy. */
  readRange(
    offset: number,
    length: number,
    signal?: AbortSignal,
  ): Promise<Uint8Array>;
}

interface Flight {
  controller: AbortController;
  promise: Promise<Uint8Array>;
  /** Callers of `load` still waiting for it. */
  waiters: number;
  /** Wanted by `request`; a flight only `load` wants ends with its last waiter. */
  requested: boolean;
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("Aborted", "AbortError");
}

type Fetched = { bytes: Uint8Array } | { flight: Flight } | { error: unknown };

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
  const fetchPage = (page: number, requested: boolean): Fetched => {
    const start = page * pageSize;
    const length = Math.min(pageSize, source.size - start);
    if (length <= 0) return { bytes: new Uint8Array(0) };
    const controller = new AbortController();
    let result: Uint8Array | Promise<Uint8Array>;
    try {
      result = source.read(start, length, controller.signal);
    } catch (error) {
      fail(page, error);
      return { error };
    }
    if (result instanceof Uint8Array) {
      sync = true;
      errors.delete(page);
      return { bytes: result };
    }
    sync = false;
    const flight = { controller, waiters: 0, requested } as Flight;
    flight.promise = result.then(
      (bytes) => {
        if (flights.get(page) === flight) {
          flights.delete(page);
          pages.set(page, bytes);
          while (pages.size > maxPages) {
            pages.delete(pages.keys().next().value as number);
          }
          notify();
        }
        return bytes;
      },
      (error: unknown) => {
        if (flights.get(page) === flight) {
          flights.delete(page);
          fail(page, error);
        }
        throw error;
      },
    );
    // `load`'s callers get the rejection; with none, it would go unhandled.
    flight.promise.catch(() => {});
    flights.set(page, flight);
    errors.delete(page);
    return { flight };
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

  const loadRange = async (
    offset: number,
    end: number,
    first: number,
    signal?: AbortSignal,
  ) => {
    const last = Math.floor((end - 1) / pageSize);
    const loads: Promise<Uint8Array>[] = [];
    for (let page = first; page <= last; page++) {
      loads.push(cache.load(page, signal));
    }
    const loaded = await Promise.all(loads);
    if (first === last) {
      const at = offset - first * pageSize;
      return (loaded[0] as Uint8Array).subarray(at, at + end - offset);
    }
    const out = new Uint8Array(end - offset);
    loaded.forEach((bytes, i) => {
      const pageStart = (first + i) * pageSize;
      const from = Math.max(offset, pageStart) - pageStart;
      const to = Math.min(end, pageStart + bytes.length) - pageStart;
      out.set(bytes.subarray(from, to), pageStart + from - offset);
    });
    return out;
  };

  const cache: PageCache = {
    pageSize,

    get(offset, length) {
      const end = Math.min(offset + length, source.size);
      if (end <= offset) return new Uint8Array(0);
      const first = Math.floor(offset / pageSize);
      const last = Math.floor((end - 1) / pageSize);
      if (sync === undefined && !flights.has(first) && !errors.has(first)) {
        fetchPage(first, true);
      }
      if (sync) {
        const bytes = readSync(offset, end - offset);
        if (bytes || sync) return bytes;
      }
      if (first === last) {
        const bytes = cachedPage(first);
        if (!bytes) return source.peek?.(offset, end - offset);
        const at = offset - first * pageSize;
        return bytes.subarray(at, at + end - offset);
      }
      const out = new Uint8Array(end - offset);
      for (let page = first; page <= last; page++) {
        const bytes = cachedPage(page);
        if (!bytes) return source.peek?.(offset, end - offset);
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
        const flight = flights.get(page);
        if (flight) flight.requested = true;
        if (pages.has(page) || flight) continue;
        fetchPage(page, true);
      }
      if (retried) notify();
    },

    retain(firstPage, lastPage) {
      let aborted = false;
      for (const [page, flight] of [...flights]) {
        if (page >= firstPage - 1 && page <= lastPage + 1) continue;
        flight.requested = false;
        if (flight.waiters > 0) continue;
        abort(page);
        aborted = true;
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
        for (const [page, flight] of [...flights]) {
          flight.requested = false;
          if (flight.waiters === 0) abort(page);
        }
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

    load(page, signal) {
      if (signal?.aborted) return Promise.reject(abortError(signal));
      const cached = cachedPage(page);
      if (cached) return Promise.resolve(cached);
      let flight = flights.get(page);
      if (!flight) {
        const fetched = fetchPage(page, false);
        if ("bytes" in fetched) return Promise.resolve(fetched.bytes);
        if ("error" in fetched) return Promise.reject(fetched.error);
        flight = fetched.flight;
      }
      const shared = flight;
      shared.waiters++;
      return new Promise<Uint8Array>((resolve, reject) => {
        let done = false;
        const finish = () => {
          done = true;
          shared.waiters--;
          signal?.removeEventListener("abort", onAbort);
        };
        const onAbort = () => {
          if (done) return;
          finish();
          reject(abortError(signal as AbortSignal));
          if (
            flights.get(page) === shared &&
            shared.waiters === 0 &&
            !shared.requested
          ) {
            abort(page);
            notify();
          }
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        shared.promise.then(
          (bytes) => {
            if (done) return;
            finish();
            resolve(bytes);
          },
          (error: unknown) => {
            if (done) return;
            finish();
            reject(error);
          },
        );
      });
    },

    read(offset, length, signal) {
      const end = Math.min(offset + length, source.size);
      if (end <= offset) return new Uint8Array(0);
      const first = Math.floor(offset / pageSize);
      if (sync === undefined) {
        if (signal?.aborted) return Promise.reject(abortError(signal));
        const fetched = flights.has(first)
          ? undefined
          : fetchPage(first, false);
        if (fetched && "error" in fetched) {
          // The page can fail where the range would not (a bad region
          // elsewhere in it), so the range alone decides; and while the kind
          // is unknown, a throw is reported the way every caller handles.
          errors.delete(first);
          let result: Uint8Array | Promise<Uint8Array>;
          try {
            result = source.read(offset, end - offset, signal);
          } catch (error) {
            return Promise.reject(error);
          }
          sync = result instanceof Uint8Array;
          return result;
        }
      }
      if (sync) {
        const result = source.read(offset, end - offset, signal);
        // Mixed sources page from here on, as in `get`.
        if (!(result instanceof Uint8Array)) sync = false;
        return result;
      }
      return loadRange(offset, end, first, signal);
    },

    sync: () => sync,

    async readRange(offset, length, signal) {
      return source.read(offset, length, signal);
    },
  };
  return cache;
}
