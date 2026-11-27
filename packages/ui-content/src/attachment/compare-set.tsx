import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComparePair } from "./compare-canvas.tsx";

type Entry = {
  anchor: RefObject<Element | null>;
  pair(): ComparePair | null;
};

type CompareSetValue = {
  register(key: symbol, entry: Entry): () => void;
  /** Undefined where no viewer can open: a lone `AttachmentViewer`'s body. */
  open: ((key: symbol) => void) | undefined;
};

const CompareSetContext = createContext<CompareSetValue | null>(null);

/**
 * The comparisons drawn below it, which `open` hands to `openCompare` in
 * document order. The order is read at the click, not kept as they mount: a
 * comparison above the others may finish loading last, and one the page
 * dropped is gone by then.
 */
export function CompareSet({
  openCompare,
  children,
}: {
  openCompare: ((pairs: ComparePair[], index: number) => void) | undefined;
  children?: ReactNode;
}) {
  const [entries] = useState(() => new Map<symbol, Entry>());
  const register = useCallback(
    (key: symbol, entry: Entry) => {
      entries.set(key, entry);
      return () => {
        entries.delete(key);
      };
    },
    [entries],
  );
  const value = useMemo<CompareSetValue>(
    () => ({
      register,
      open:
        openCompare === undefined
          ? undefined
          : (key) => {
              const shown = [...entries]
                .map(([k, entry]) => ({
                  k,
                  anchor: entry.anchor.current,
                  pair: entry.pair(),
                }))
                .filter(
                  (e): e is { k: symbol; anchor: Element; pair: ComparePair } =>
                    e.anchor?.isConnected === true && e.pair !== null,
                )
                .sort((a, b) =>
                  a.anchor === b.anchor
                    ? 0
                    : a.anchor.compareDocumentPosition(b.anchor) &
                        Node.DOCUMENT_POSITION_FOLLOWING
                      ? -1
                      : 1,
                );
              const index = shown.findIndex((e) => e.k === key);
              if (index === -1) return;
              openCompare(
                shown.map((e) => e.pair),
                index,
              );
            },
    }),
    [entries, register, openCompare],
  );
  return (
    <CompareSetContext.Provider value={value}>
      {children}
    </CompareSetContext.Provider>
  );
}

/**
 * Puts a comparison drawn on the page in the nearest AttachmentViewerProvider's set:
 * opening any comparison in the set pages through all of them, in document order,
 * starting at this one. `anchor` is an element of the comparison, which places it in
 * that order. Returns what opens it, for MediaCompare's `onOpen`: undefined outside a
 * provider, and while `pair` is null (a side still loading).
 */
export function useViewerCompare(
  pair: ComparePair | null,
  anchor: RefObject<Element | null>,
): (() => void) | undefined {
  const set = useContext(CompareSetContext);
  // Read at the click, so a pair that changes does not register again.
  const latest = useRef(pair);
  useLayoutEffect(() => {
    latest.current = pair;
  });
  const [key] = useState(() => Symbol("comparison"));
  const register = set?.register;
  useEffect(
    () => register?.(key, { anchor, pair: () => latest.current }),
    [register, key, anchor],
  );
  const open = set?.open;
  const openThis = useCallback(() => open?.(key), [open, key]);
  return open === undefined || pair === null ? undefined : openThis;
}
