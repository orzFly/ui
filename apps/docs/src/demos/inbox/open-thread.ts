import { useSyncExternalStore } from "react";

const PARAM = "thread";
/** Fired on `window` when this module changes the URL; `pushState` fires nothing itself. */
const CHANGE = "orz-docs:thread";

function subscribe(onChange: () => void) {
  addEventListener("popstate", onChange);
  addEventListener(CHANGE, onChange);
  return () => {
    removeEventListener("popstate", onChange);
    removeEventListener(CHANGE, onChange);
  };
}

const read = () => new URLSearchParams(location.search).get(PARAM);

/**
 * The open thread, kept in the URL as `?thread=<id>`: Back and a phone's edge swipe return to the
 * list, and a thread can be linked. Null on the server, which prerenders the list alone.
 */
export function useOpenThread(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Marks the history entry this module pushed, so the in-page Back can step back over it. */
interface Pushed {
  inboxThread: true;
}

/** The URL with `?thread=` set to `id`, or dropped. */
export function threadHref(id: string | null): string {
  const url = new URL(location.href);
  if (id === null) url.searchParams.delete(PARAM);
  else url.searchParams.set(PARAM, id);
  return url.pathname + url.search + url.hash;
}

/**
 * Open `id`. From the list it pushes an entry, which Back pops; from another thread it replaces
 * the entry, so Back never walks through every thread the reader glanced at.
 */
export function openThread(id: string) {
  const from = read();
  if (from === id) return;
  if (from === null) {
    history.pushState(
      { inboxThread: true } satisfies Pushed,
      "",
      threadHref(id),
    );
  } else {
    history.replaceState(history.state, "", threadHref(id));
  }
  dispatchEvent(new Event(CHANGE));
}

/** Back to the list: the browser's Back where this page pushed the thread, else in place. */
export function closeThread() {
  if ((history.state as Partial<Pushed> | null)?.inboxThread) {
    history.back();
    return;
  }
  history.replaceState(history.state, "", threadHref(null));
  dispatchEvent(new Event(CHANGE));
}
