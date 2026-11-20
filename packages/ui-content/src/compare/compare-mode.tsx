import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/**
 * How a comparison of two pictures is drawn: side by side, the newer swiped
 * over the older, the newer faded over it (onion skin), or the difference of
 * the two.
 */
export type CompareMode = "2up" | "swipe" | "onion" | "diff";

/** Every mode, in the order the mode control offers them. */
export const COMPARE_MODES: readonly CompareMode[] = [
  "2up",
  "swipe",
  "onion",
  "diff",
];

type Shared = { mode: CompareMode; setMode(mode: CompareMode): void };

const CompareModeContext = createContext<Shared | null>(null);

export type CompareModeProviderProps = {
  /** The shared mode, controlled. */
  mode?: CompareMode;
  /** Where an uncontrolled provider starts. Default `"2up"`. */
  defaultMode?: CompareMode;
  onModeChange?(mode: CompareMode): void;
  children?: ReactNode;
};

/**
 * One mode for every comparison below it, so switching one switches them
 * all: a page of screenshots read one way. Without one, each comparison
 * keeps its own.
 */
export function CompareModeProvider({
  mode: controlled,
  defaultMode = "2up",
  onModeChange,
  children,
}: CompareModeProviderProps) {
  const [own, setOwn] = useState(defaultMode);
  const mode = controlled ?? own;
  const setMode = useCallback(
    (next: CompareMode) => {
      if (controlled === undefined) setOwn(next);
      onModeChange?.(next);
    },
    [controlled, onModeChange],
  );
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return (
    <CompareModeContext.Provider value={value}>
      {children}
    </CompareModeContext.Provider>
  );
}

/**
 * A comparison's mode: the caller's when it controls it, else the nearest
 * `CompareModeProvider`'s, else one of its own starting at `defaultMode`.
 * Choosing a mode writes it where it was read from, and reports it.
 */
export function useCompareMode({
  mode: controlled,
  defaultMode = "2up",
  onModeChange,
}: {
  mode?: CompareMode;
  defaultMode?: CompareMode;
  onModeChange?(mode: CompareMode): void;
} = {}): [CompareMode, (mode: CompareMode) => void] {
  const shared = useContext(CompareModeContext);
  const [own, setOwn] = useState(defaultMode);
  const mode = controlled ?? shared?.mode ?? own;
  const setMode = useCallback(
    (next: CompareMode) => {
      if (controlled === undefined) {
        if (shared !== null) shared.setMode(next);
        else setOwn(next);
      }
      onModeChange?.(next);
    },
    [controlled, shared, onModeChange],
  );
  return [mode, setMode];
}
