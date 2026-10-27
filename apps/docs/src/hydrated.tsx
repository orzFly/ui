import { type ReactNode, useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False on the server and through hydration, true after. For what the
 * prerendered HTML cannot know: the theme store, which lives in the browser,
 * and anything that reads `matchMedia` while it renders.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return useHydrated() ? children : fallback;
}
