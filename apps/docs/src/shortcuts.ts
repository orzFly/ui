import { useSyncExternalStore } from "react";

/** Holds `"off"` while the reader has turned the site's single-key shortcuts off. */
const STORAGE_KEY = "orz-docs-shortcuts";

const listeners = new Set<() => void>();
/** The choice when storage refuses it (a private window): it lasts for this page only. */
let fallback = true;

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab turning them off follows here too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return fallback;
  }
}

/** Whether `/` focuses the search (WCAG SC 2.1.4); on until the reader says otherwise. */
export function useShortcutsEnabled(): boolean {
  return useSyncExternalStore(subscribe, read, () => true);
}

export function setShortcutsEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, "off");
  } catch {
    fallback = enabled;
  }
  for (const listener of listeners) listener();
}
