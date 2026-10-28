import { useSyncExternalStore } from "react";
import { hrefOf } from "../../routes.ts";
import { DEFAULT_QUERY } from "./mailbox.ts";

// Absolute, so a prerendered link carries the base. Spelled out rather than read from the router,
// which would pull every page's meta into this demo's tests.
const PAGE = hrefOf("/demos/inbox/", import.meta.env.BASE_URL);

/** A thread's own address, for its row's link. */
export const threadHref = (id: string) =>
  `${PAGE}?thread=${encodeURIComponent(id)}`;

/** A folder's or a search's own address, for a link that opens it in a new tab. */
export const placeHref = (query: string) =>
  query === DEFAULT_QUERY ? PAGE : `${PAGE}?q=${encodeURIComponent(query)}`;

const THREAD = "thread";
const QUERY = "q";
/** Fired on `window` when this module changes the URL; `pushState` fires nothing itself. */
const CHANGE = "orz-docs:mail";

function subscribe(onChange: () => void) {
  addEventListener("popstate", onChange);
  addEventListener(CHANGE, onChange);
  return () => {
    removeEventListener("popstate", onChange);
    removeEventListener(CHANGE, onChange);
  };
}

const param = (name: string) => new URLSearchParams(location.search).get(name);
const readThread = () => param(THREAD);
const readQuery = () => param(QUERY) ?? DEFAULT_QUERY;

/**
 * The open thread, kept in the URL as `?thread=<id>`: Back and a phone's edge swipe return to the
 * list, and a thread can be linked. Null on the server, which prerenders the list alone.
 */
export function useOpenThread(): string | null {
  return useSyncExternalStore(subscribe, readThread, () => null);
}

/** The search the list shows, kept in the URL as `?q=`, so a folder can be linked and Back leaves it. */
export function useQuery(): string {
  return useSyncExternalStore(subscribe, readQuery, () => DEFAULT_QUERY);
}

/** Marks the history entry this module pushed for a thread, so the in-page Back can step back over it. */
interface Pushed {
  inboxThread: true;
}

/** The URL with each of `params` set, or dropped where null. */
export function mailHref(params: { thread?: string | null; q?: string }) {
  const url = new URL(location.href);
  if (params.thread !== undefined) {
    if (params.thread === null) url.searchParams.delete(THREAD);
    else url.searchParams.set(THREAD, params.thread);
  }
  if (params.q !== undefined) {
    if (params.q === DEFAULT_QUERY) url.searchParams.delete(QUERY);
    else url.searchParams.set(QUERY, params.q);
  }
  return url.pathname + url.search + url.hash;
}

/**
 * Open `id`. From the list it pushes an entry, which Back pops; from another thread it replaces
 * the entry, so Back never walks through every thread the reader glanced at.
 */
export function openThread(id: string) {
  const from = readThread();
  if (from === id) return;
  if (from === null) {
    history.pushState(
      { inboxThread: true } satisfies Pushed,
      "",
      mailHref({ thread: id }),
    );
  } else {
    history.replaceState(history.state, "", mailHref({ thread: id }));
  }
  dispatchEvent(new Event(CHANGE));
}

/** Back to the list: the browser's Back where this page pushed the thread, else in place. */
export function closeThread() {
  if ((history.state as Partial<Pushed> | null)?.inboxThread) {
    history.back();
    return;
  }
  history.replaceState(history.state, "", mailHref({ thread: null }));
  dispatchEvent(new Event(CHANGE));
}

/** Show the threads `query` matches, a folder's or a typed one, as a new history entry. */
export function showQuery(query: string) {
  if (readQuery() === query && readThread() === null) return;
  history.pushState(null, "", mailHref({ q: query, thread: null }));
  dispatchEvent(new Event(CHANGE));
}
