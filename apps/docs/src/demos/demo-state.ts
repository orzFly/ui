import { useSyncExternalStore } from "react";

/** Fired on `window` when `setHash` changes the URL; `pushState` fires no `hashchange` itself. */
const HASH_CHANGE = "orz-docs:demo-hash";

function subscribeHash(listener: () => void) {
  addEventListener("hashchange", listener);
  addEventListener("popstate", listener);
  addEventListener(HASH_CHANGE, listener);
  return () => {
    removeEventListener("hashchange", listener);
    removeEventListener("popstate", listener);
    removeEventListener(HASH_CHANGE, listener);
  };
}

const readHash = () => decodeURIComponent(location.hash.slice(1));

/**
 * A demo's place kept in the URL's hash (`#issues`), so each place is a plain `#` link that a
 * middle click opens in a new tab; "" with no hash, and on the server, which prerenders the first.
 */
export function useHash(): string {
  return useSyncExternalStore(subscribeHash, readHash, () => "");
}

/** Moves to `hash`, or drops it where "", without the browser's jump to an element of that id. */
export function setHash(
  hash: string,
  { push, state = null }: { push: boolean; state?: unknown },
): void {
  const url = location.pathname + location.search + (hash && `#${hash}`);
  if (push) history.pushState(state, "", url);
  else history.replaceState(state, "", url);
  dispatchEvent(new Event(HASH_CHANGE));
}
