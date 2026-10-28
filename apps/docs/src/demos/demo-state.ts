import { useSyncExternalStore } from "react";

/** Holds `"open"` while the reader keeps a demo's About panel open. */
const ABOUT_KEY = "orz-docs-demo-about";

const aboutListeners = new Set<() => void>();
/** The choice when storage refuses it (a private window): it lasts for this page only. */
let aboutFallback = false;

function subscribeAbout(listener: () => void) {
  aboutListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === ABOUT_KEY) listener();
  };
  addEventListener("storage", onStorage);
  return () => {
    aboutListeners.delete(listener);
    removeEventListener("storage", onStorage);
  };
}

function readAbout(): boolean {
  try {
    return localStorage.getItem(ABOUT_KEY) === "open";
  } catch {
    return aboutFallback;
  }
}

/** Whether the About panel is open beside a demo; closed until the reader opens it, on every demo. */
export function useAboutOpen(): boolean {
  return useSyncExternalStore(subscribeAbout, readAbout, () => false);
}

export function setAboutOpen(open: boolean): void {
  try {
    if (open) localStorage.setItem(ABOUT_KEY, "open");
    else localStorage.removeItem(ABOUT_KEY);
  } catch {
    aboutFallback = open;
  }
  for (const listener of aboutListeners) listener();
}

const SOURCE = "source";
const SOURCE_CHANGE = "orz-docs:demo-source";

function subscribeSource(listener: () => void) {
  addEventListener("popstate", listener);
  addEventListener(SOURCE_CHANGE, listener);
  return () => {
    removeEventListener("popstate", listener);
    removeEventListener(SOURCE_CHANGE, listener);
  };
}

const readSource = () => new URLSearchParams(location.search).get(SOURCE);

/**
 * The file the Code view shows, kept in the URL as `?source=<name>` so a file can be linked; null
 * while the demo itself shows, and on the server, which prerenders the demo.
 */
export function useSourceParam(): string | null {
  return useSyncExternalStore(subscribeSource, readSource, () => null);
}

/**
 * Replaces rather than pushes: Back leaves the demo, as it would from any page, instead of
 * stepping through the files looked at. The demo's own parameters stay.
 */
export function setSourceParam(name: string | null): void {
  const url = new URL(location.href);
  if (name === null) url.searchParams.delete(SOURCE);
  else url.searchParams.set(SOURCE, name);
  // A query may hold `/` and `@` as they are; `?source=@orz/fixtures/inbox.ts` reads as the import.
  const search = url.search.replace(/%2F/gi, "/").replace(/%40/g, "@");
  history.replaceState(history.state, "", url.pathname + search + url.hash);
  dispatchEvent(new Event(SOURCE_CHANGE));
}
