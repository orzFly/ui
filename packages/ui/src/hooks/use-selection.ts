import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

/** How much of a list, or of a group in it, is selected. */
export type SelectionState = "none" | "some" | "all";

export type Selection<K> = {
  /** The selected keys, in the list's order, and only those still in it. */
  selected: readonly K[];
  isSelected: (key: K) => boolean;
  /**
   * Flips one key. With `extend` (a shift-click) every key from the last one toggled or painted
   * to this one takes this one's new state, as a file manager does.
   */
  toggle: (key: K, options?: { extend?: boolean }) => void;
  /** The header checkbox: anything short of all selects all, and all selects none. */
  toggleAll: () => void;
  /** `toggleAll` over part of the list, such as one column of a board. */
  toggleGroup: (group: readonly K[]) => void;
  /** `state` over part of the list. */
  groupState: (group: readonly K[]) => SelectionState;
  /**
   * Sets `keys` to `on` whatever they were, for a sweep across the boxes. The last key becomes
   * the one a shift-click extends from.
   */
  paint: (keys: readonly K[], on: boolean) => void;
  clear: () => void;
  state: SelectionState;
};

export type SelectionOptions<K> = {
  /** The selection, when the app holds it; any order, and keys not in the list are ignored. */
  selected?: readonly K[];
  /** The selection to start from, when the hook holds it. */
  defaultSelected?: readonly K[];
  /** Hears each change, with the keys in the list's order. */
  onSelectedChange?: (selected: K[]) => void;
};

function stateOf(count: number, total: number): SelectionState {
  return count === 0 ? "none" : count === total ? "all" : "some";
}

/**
 * Several rows of a list selected at once, for a `SelectionBar` to count and act on. A key that
 * leaves `keys` (deleted, moved, filtered out) drops out of `selected` on the same render, so an
 * action never reaches a row the reader no longer sees, and stays out once the selection next
 * changes.
 *
 * Held here, or by the app through `selected` and `onSelectedChange`.
 */
export function useSelection<K>(
  keys: readonly K[],
  options: SelectionOptions<K> = {},
): Selection<K> {
  const { selected: controlled, defaultSelected, onSelectedChange } = options;
  const [own, setOwn] = useState<ReadonlySet<K>>(
    () => new Set(defaultSelected),
  );
  const picked = useMemo(
    () => (controlled === undefined ? own : new Set(controlled)),
    [controlled, own],
  );
  const selected = useMemo(
    () => keys.filter((key) => picked.has(key)),
    [keys, picked],
  );
  const live = useMemo(() => new Set(selected), [selected]);

  // Where a shift-click extends from.
  const anchor = useRef<{ key: K } | null>(null);
  // The selection as last changed, ahead of the render that shows it: a sweep paints on every
  // pointer move, and two moves can land before the next render. Each render puts it back to
  // what is shown, which an app holding the selection may have turned down.
  const pending = useRef<ReadonlySet<K>>(live);
  const latest = useRef({ keys, controlled, onSelectedChange });
  useLayoutEffect(() => {
    pending.current = live;
    latest.current = { keys, controlled, onSelectedChange };
  });

  const commit = useCallback((next: Set<K>) => {
    const { keys, controlled, onSelectedChange } = latest.current;
    const pruned = keys.filter((key) => next.has(key));
    pending.current = new Set(pruned);
    if (controlled === undefined) setOwn(pending.current);
    onSelectedChange?.(pruned);
  }, []);

  const change = useCallback(
    (span: readonly K[], on: boolean) => {
      const next = new Set(pending.current);
      for (const key of span) {
        if (on) next.add(key);
        else next.delete(key);
      }
      commit(next);
    },
    [commit],
  );

  const toggle = useCallback(
    (key: K, { extend = false }: { extend?: boolean } = {}) => {
      const { keys } = latest.current;
      const on = !pending.current.has(key);
      const from = anchor.current ? keys.indexOf(anchor.current.key) : -1;
      const to = keys.indexOf(key);
      const span =
        extend && from !== -1 && to !== -1
          ? keys.slice(Math.min(from, to), Math.max(from, to) + 1)
          : [key];
      anchor.current = { key };
      change(span, on);
    },
    [change],
  );

  const groupState = useCallback(
    (group: readonly K[]) =>
      stateOf(group.filter((key) => live.has(key)).length, group.length),
    [live],
  );

  const toggleGroup = useCallback(
    (group: readonly K[]) => {
      anchor.current = null;
      const current = pending.current;
      const all = group.every((key) => current.has(key));
      change(group, !all);
    },
    [change],
  );

  const toggleAll = useCallback(
    () => toggleGroup(latest.current.keys),
    [toggleGroup],
  );

  const paint = useCallback(
    (painted: readonly K[], on: boolean) => {
      const last = painted.at(-1);
      if (last === undefined) return;
      anchor.current = { key: last };
      change(painted, on);
    },
    [change],
  );

  const clear = useCallback(() => {
    anchor.current = null;
    commit(new Set());
  }, [commit]);

  const isSelected = useCallback((key: K) => live.has(key), [live]);

  return {
    selected,
    isSelected,
    toggle,
    toggleAll,
    toggleGroup,
    groupState,
    paint,
    clear,
    state: stateOf(selected.length, keys.length),
  };
}
