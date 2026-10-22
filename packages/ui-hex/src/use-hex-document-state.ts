import { useCallback, useRef, useSyncExternalStore } from "react";

import { documentVersion, type HexDocument } from "./document.ts";

export interface HexDocumentState {
  size: number;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

/** What a toolbar or a title shows about a document; a new object only after it changes. */
export function useHexDocumentState(doc: HexDocument): HexDocumentState {
  const cached = useRef<{
    doc: HexDocument;
    version: number;
    state: HexDocumentState;
  } | null>(null);
  const getSnapshot = useCallback(() => {
    const version = documentVersion(doc);
    const last = cached.current;
    if (last?.doc === doc && last.version === version) return last.state;
    const state = {
      size: doc.size,
      dirty: doc.dirty,
      canUndo: doc.canUndo,
      canRedo: doc.canRedo,
    };
    cached.current = { doc, version, state };
    return state;
  }, [doc]);
  return useSyncExternalStore(doc.subscribe, getSnapshot, getSnapshot);
}
