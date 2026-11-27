import * as React from "react";
import type { OverflowResult, OverflowStore, PartMeta } from "./store.ts";

/**
 * Connects the store once mounted, solves after every commit, and hands the
 * focus to the ⋯ when the part that held it has just gone into the menu.
 * `hydrated` turns true in the commit that mounts the row, before it is
 * first painted on a client render.
 */
export function useOverflowRoot<M extends PartMeta>(
  store: OverflowStore<M, OverflowResult>,
): { hydrated: boolean } {
  // Each new layout commits here too, so the focus is handed over in it.
  React.useSyncExternalStore(store.subscribe, store.getResult, store.getResult);
  const [hydrated, setHydrated] = React.useState(false);
  React.useLayoutEffect(() => {
    setHydrated(true);
    return store.connect();
  }, [store]);
  React.useLayoutEffect(() => {
    store.solve();
    if (!store.rescueFocus) return;
    store.rescueFocus = false;
    store.triggerRef.current?.focus({ preventScroll: true });
  });
  return { hydrated };
}
