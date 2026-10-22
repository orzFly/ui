import { createContext, type ReactNode, useContext } from "react";
import type { ContentSource } from "./types.ts";

type Slot = { source: ContentSource; target: HTMLElement | null };

const TitleBarContext = createContext<Slot | null>(null);

/**
 * Lends a spot in a surface's title bar to the renderer that draws `source` below, for controls
 * that belong next to the surface's own (a patch's file list, an image's zoom).
 *
 * Keyed by the source object rather than by nesting: a renderer hands a nested source a new
 * object (a markdown fence, an embedded file), so only the one drawing `source` itself sees the
 * spot, and a ```diff fence inside a markdown card never takes over the card's bar.
 */
export function ContentTitleBar({
  source,
  target,
  children,
}: {
  source: ContentSource;
  /** The element the controls portal into; null until it has mounted. */
  target: HTMLElement | null;
  children?: ReactNode;
}) {
  return (
    <TitleBarContext.Provider value={{ source, target }}>
      {children}
    </TitleBarContext.Provider>
  );
}

/**
 * Where this source's controls go: an element to portal into, null while the title bar is still
 * mounting, or undefined when no surface lent one for it, in which case the renderer draws a bar
 * of its own if it needs one.
 */
export function useContentTitleBar(
  source: ContentSource,
): HTMLElement | null | undefined {
  const slot = useContext(TitleBarContext);
  return slot !== null && slot.source === source ? slot.target : undefined;
}
