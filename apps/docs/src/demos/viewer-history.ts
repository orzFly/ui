import type { AttachmentViewerState } from "@orz/ui-content/attachment";
import { useRef, useState, useSyncExternalStore } from "react";

const VIEW = "view";
/** Fired on `window` when this module changes the URL; `pushState` fires nothing itself. */
const CHANGE = "orz-docs:viewer";

/**
 * Marks a history entry the viewer is open on. `viewer` tells this page's openings apart, so an
 * entry a reload left behind does not show what was opened since; `pushed` says whether opening
 * took the entry, which closing then steps back over.
 */
interface Mark {
  viewer: string;
  pushed: boolean;
}

type Entry = Partial<Mark> & Record<string, unknown>;

// Entries outlive a reload, and so do their marks; the time keeps this load's apart.
const LOAD = Date.now().toString(36);
let opened = 0;
const nextMark = () => `${LOAD}-${++opened}`;

function subscribe(onChange: () => void) {
  addEventListener("popstate", onChange);
  addEventListener(CHANGE, onChange);
  return () => {
    removeEventListener("popstate", onChange);
    removeEventListener(CHANGE, onChange);
  };
}

const entry = () => history.state as Entry | null;
const readMark = () => entry()?.viewer ?? null;
const readView = () => new URLSearchParams(location.search).get(VIEW);

function hrefWith(name: string | null) {
  const url = new URL(location.href);
  if (name === null) url.searchParams.delete(VIEW);
  else url.searchParams.set(VIEW, name);
  return url.pathname + url.search + url.hash;
}

function unmarked(state: Entry | null): Entry {
  const rest = { ...state };
  delete rest.viewer;
  delete rest.pushed;
  return rest;
}

/** What the viewer's title names: the file it shows, or a comparison's; null for drawn text. */
function shownName(state: AttachmentViewerState): string | null {
  if ("items" in state) {
    const item = state.items[state.index];
    return item?.kind === "file" ? item.name : null;
  }
  const pair = state.compare[state.index];
  return pair?.title ?? pair?.after.file?.name ?? null;
}

/**
 * The attachment viewer kept in the browser's history, as the Overlays guideline asks. Opening
 * pushes an entry that Back pops; paging, or opening another file from inside, replaces it; closing
 * steps back over the entry opening pushed, or replaces the address where a link reached the viewer
 * and nothing was pushed. The address names what the viewer shows as `?view=<name>` where `find`
 * turns the name back into it, so a reload or a link reopens it. Closed on the server, which
 * prerenders the demo.
 */
export function useViewerHistory(
  find: (name: string) => AttachmentViewerState | null,
): {
  state: AttachmentViewerState | null;
  onStateChange(next: AttachmentViewerState | null): void;
} {
  const mark = useSyncExternalStore(subscribe, readMark, () => null);
  const view = useSyncExternalStore(subscribe, readView, () => null);
  // The address names one file; what was opened here also knows the set it pages through.
  const [held, setHeld] = useState<{
    mark: string;
    state: AttachmentViewerState;
  } | null>(null);
  // A second close can come before the browser has stepped back from the first; once it has,
  // the entry is another, and coming Forward to this one again closes as before.
  const leaving = useRef<string | null>(null);
  if (leaving.current !== mark) leaving.current = null;

  const state =
    held !== null && mark !== null && held.mark === mark
      ? held.state
      : view !== null
        ? find(view)
        : null;

  const onStateChange = (next: AttachmentViewerState | null) => {
    const now = entry();
    if (next === null) {
      if (now?.pushed && now.viewer !== undefined) {
        if (leaving.current === now.viewer) return;
        leaving.current = now.viewer;
        history.back();
        return;
      }
      history.replaceState(unmarked(now), "", hrefWith(null));
    } else {
      const name = shownName(next);
      const href = hrefWith(name !== null && find(name) !== null ? name : null);
      if (state === null) {
        const taken: Mark = { viewer: nextMark(), pushed: true };
        setHeld({ mark: taken.viewer, state: next });
        history.pushState({ ...unmarked(now), ...taken }, "", href);
      } else {
        const kept: Mark = {
          viewer: now?.viewer ?? nextMark(),
          pushed: now?.pushed === true,
        };
        setHeld({ mark: kept.viewer, state: next });
        history.replaceState({ ...now, ...kept }, "", href);
      }
    }
    dispatchEvent(new Event(CHANGE));
  };

  return { state, onStateChange };
}
