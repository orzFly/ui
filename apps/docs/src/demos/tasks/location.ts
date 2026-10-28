import { useSyncExternalStore } from "react";
import { hrefOf } from "../../routes.ts";

// Absolute, so a prerendered link carries the base. Spelled out rather than read from the router,
// which would pull every page's meta into this demo's tests.
const PAGE = hrefOf("/demos/tasks/", import.meta.env.BASE_URL);

const TASK = "task";
/** Fired on `window` when this module changes the URL; `pushState` fires nothing itself. */
const CHANGE = "orz-docs:tasks";

/** A task's own address, for its title's link and Copy link. */
export const taskHref = (id: number) => `${PAGE}?${TASK}=${id}`;

function subscribe(onChange: () => void) {
  addEventListener("popstate", onChange);
  addEventListener(CHANGE, onChange);
  return () => {
    removeEventListener("popstate", onChange);
    removeEventListener(CHANGE, onChange);
  };
}

function readTask(): number | null {
  const id = Number(new URLSearchParams(location.search).get(TASK));
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * The task whose details show, kept in the URL as `?task=<id>`: Back closes them, and a task can
 * be linked. Null on the server, which prerenders the list alone.
 */
export function useOpenTask(): number | null {
  return useSyncExternalStore(subscribe, readTask, () => null);
}

/** Marks the history entry this module pushed, so closing the details can step back over it. */
interface Pushed {
  tasksDetails: true;
}

function hrefWith(id: number | null) {
  const url = new URL(location.href);
  if (id === null) url.searchParams.delete(TASK);
  else url.searchParams.set(TASK, String(id));
  return url.pathname + url.search + url.hash;
}

/**
 * Show `id`'s details. From the list it pushes an entry, which Back pops; from another task's
 * details it replaces the entry, so Back never walks through every task the reader glanced at.
 */
export function openTask(id: number) {
  const from = readTask();
  if (from === id) return;
  if (from === null) {
    history.pushState(
      { tasksDetails: true } satisfies Pushed,
      "",
      hrefWith(id),
    );
  } else {
    history.replaceState(history.state, "", hrefWith(id));
  }
  dispatchEvent(new Event(CHANGE));
}

/** Close the details: the browser's Back where this page pushed them, else in place. */
export function closeTask() {
  if ((history.state as Partial<Pushed> | null)?.tasksDetails) {
    history.back();
    return;
  }
  history.replaceState(history.state, "", hrefWith(null));
  dispatchEvent(new Event(CHANGE));
}
