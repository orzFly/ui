/** A node of a `Tree`: a branch when it has `children` (even none), a leaf otherwise. */
export interface TreeNode<T> {
  id: string;
  children?: readonly T[];
  /**
   * A branch whose children are not loaded yet: it draws its toggle, and shows a loading row
   * while open, until `children` arrives.
   */
  hasChildren?: boolean;
}

/**
 * How a filter shows the tree: only the matches and their ancestors, or every row with the
 * matches' ancestors opened on top of the reader's own branches, or in place of them.
 */
export type TreeFilterMode = "hide" | "expand" | "collapse";

/** A node on screen, with where it stands among the rows around it. */
export interface TreeRow<T> {
  kind: "item";
  item: T;
  /** 1 at the root, as `aria-level` counts. */
  level: number;
  /** Its place among its visible siblings, from 1. */
  posinset: number;
  setsize: number;
  branch: boolean;
  /** Open on screen: while filtering, whether any child is shown, whatever the reader opened. */
  expanded: boolean;
  last: boolean;
  /**
   * One entry per ancestor, root first: whether that ancestor has a visible sibling after it,
   * which is where a connector line runs on down past this row.
   */
  continues: readonly boolean[];
  parentId: string | undefined;
  /** `filter` matches this node; false with no filter. */
  match: boolean;
}

/** The row an open branch shows until its children arrive. */
export interface TreeLoadingRow {
  kind: "loading";
  parentId: string;
  level: number;
  continues: readonly boolean[];
}

const isBranch = (node: TreeNode<unknown>) =>
  node.children !== undefined || node.hasChildren === true;

/**
 * The rows a tree shows, in order: every root, and the children of each open branch. With
 * `filter`, the nodes it matches and their ancestors, each ancestor open whatever `expanded`
 * holds, so clearing the filter brings back the reader's own branches. In the `"expand"` and
 * `"collapse"` modes every row shows, opened as `expanded` holds, which the caller works out
 * for the search (`matchAncestors`); the filter only marks the matches.
 */
export function visibleRows<T extends TreeNode<T>>(
  items: readonly T[],
  expanded: ReadonlySet<string>,
  filter?: (item: T) => boolean,
  mode: TreeFilterMode = "hide",
): (TreeRow<T> | TreeLoadingRow)[] {
  const shown = filter && mode === "hide" ? matching(items, filter) : undefined;
  const rows: (TreeRow<T> | TreeLoadingRow)[] = [];

  const walk = (
    nodes: readonly T[],
    level: number,
    continues: readonly boolean[],
    parentId: string | undefined,
  ) => {
    const siblings = shown ? nodes.filter((n) => shown.has(n.id)) : nodes;
    siblings.forEach((item, index) => {
      const last = index === siblings.length - 1;
      const branch = isBranch(item);
      const children = item.children;
      const open = shown
        ? children?.some((c) => shown.has(c.id)) === true
        : branch && expanded.has(item.id);
      rows.push({
        kind: "item",
        item,
        level,
        posinset: index + 1,
        setsize: siblings.length,
        branch,
        expanded: open,
        last,
        continues,
        parentId,
        match: filter?.(item) ?? false,
      });
      if (!open) return;
      const below = [...continues, !last];
      if (children) walk(children, level + 1, below, item.id);
      else
        rows.push({
          kind: "loading",
          parentId: item.id,
          level: level + 1,
          continues: below,
        });
    });
  };

  walk(items, 1, [], undefined);
  return rows;
}

/** The ids of the nodes `filter` matches and of every ancestor of one. */
function matching<T extends TreeNode<T>>(
  items: readonly T[],
  filter: (item: T) => boolean,
): Set<string> {
  const shown = new Set<string>();
  const visit = (node: T): boolean => {
    let keep = filter(node);
    for (const child of node.children ?? []) {
      if (visit(child)) keep = true;
    }
    if (keep) shown.add(node.id);
    return keep;
  };
  for (const item of items) visit(item);
  return shown;
}

/** The ids of every ancestor of a node `filter` matches, root first, each once. */
export function matchAncestors<T extends TreeNode<T>>(
  items: readonly T[],
  filter: (item: T) => boolean,
): string[] {
  const found: string[] = [];
  const visit = (node: T): boolean => {
    // Known only once its children are seen; the place before them keeps
    // the parent ahead of its children.
    const at = found.length;
    let below = false;
    for (const child of node.children ?? []) {
      if (visit(child)) below = true;
    }
    if (below) found.splice(at, 0, node.id);
    return below || filter(node);
  };
  for (const item of items) visit(item);
  return found;
}

/**
 * The ids from the root down to the node's parent, or `undefined` when no node has `id`. An app
 * holding `expanded` itself opens these before its first render, so the current place shows
 * without a frame of the tree closed.
 */
export function ancestorsOf<T extends TreeNode<T>>(
  items: readonly T[],
  id: string,
): string[] | undefined {
  for (const item of items) {
    if (item.id === id) return [];
    if (!item.children) continue;
    const below = ancestorsOf(item.children, id);
    if (below) return [item.id, ...below];
  }
  return undefined;
}

export type TreeDropPosition = "into" | "before" | "after";

/** Where a move puts an item. */
export interface TreeMoveTarget {
  /** The new parent; undefined is the root. */
  parentId: string | undefined;
  /** Its place among the new parent's children, counted with the moved item taken out. */
  index: number;
  /** The row the pointer or the focus is on, and where the item goes against it. */
  over: string;
  position: TreeDropPosition;
}

/** Where on a row the pointer is: a branch has three zones, a leaf two (top half is "top"). */
export type TreeDropZone = "top" | "middle" | "bottom";

interface Place<T> {
  parent: T | undefined;
  siblings: readonly T[];
  index: number;
}

/** A node's parent and its place among its siblings, shown or not. */
function placeOf<T extends TreeNode<T>>(
  nodes: readonly T[],
  id: string,
  parent?: T,
): Place<T> | undefined {
  for (const [index, node] of nodes.entries()) {
    if (node.id === id) return { parent, siblings: nodes, index };
    if (!node.children) continue;
    const below = placeOf(node.children, id, node);
    if (below) return below;
  }
  return undefined;
}

const contains = <T extends TreeNode<T>>(node: T, id: string): boolean =>
  node.id === id || (node.children ?? []).some((c) => contains(c, id));

/** The children of `parentId`, the roots when it is undefined. */
function childrenOf<T extends TreeNode<T>>(
  items: readonly T[],
  parentId: string | undefined,
): readonly T[] | undefined {
  if (parentId === undefined) return items;
  for (const node of items) {
    if (node.id === parentId) return node.children ?? [];
    const below = node.children && childrenOf(node.children, parentId);
    if (below) return below;
  }
  return undefined;
}

/** `moved` without the items another item of it contains, in its order. */
export function outermost<T extends TreeNode<T>>(moved: readonly T[]): T[] {
  return moved.filter(
    (item) =>
      !moved.some((other) => other !== item && contains(other, item.id)),
  );
}

/**
 * The first target a move of `moved` onto `rows[overIndex]` can take, trying the zone's own
 * position, then into the row when it is a branch, then into the row's parent after it. Refuses
 * a target inside any moved item and one that leaves the group where it is; `canDrop` is asked
 * for each item and must pass for all. `zone` undefined tries the paste order: a branch into it
 * then after it, a leaf after it then into its parent.
 */
export function moveTarget<T extends TreeNode<T>>(
  rows: readonly (TreeRow<T> | TreeLoadingRow)[],
  items: readonly T[],
  moved: readonly T[],
  overIndex: number,
  zone: TreeDropZone | undefined,
  canDrop: (item: T, target: TreeMoveTarget, group: readonly T[]) => boolean,
): TreeMoveTarget | undefined {
  let row = rows[overIndex];
  if (row?.kind === "loading") {
    // A loading row stands for the middle of the branch it loads.
    const parentId = row.parentId;
    overIndex = rows.findIndex(
      (r) => r.kind === "item" && r.item.id === parentId,
    );
    row = rows[overIndex];
    zone = "middle";
  }
  const ids = new Set(moved.map((m) => m.id));
  // Before, after, into or beside itself, a node stays where it is.
  if (row?.kind !== "item" || ids.has(row.item.id) || moved.length === 0)
    return undefined;
  const over = row;
  const at = placeOf(items, over.item.id);
  if (!at || moved.some((m) => !placeOf(items, m.id))) return undefined;

  const without = (list: readonly T[]) => list.filter((n) => !ids.has(n.id));
  const beside = (after: boolean): TreeMoveTarget => ({
    parentId: at.parent?.id,
    index:
      without(at.siblings).findIndex((n) => n.id === over.item.id) +
      (after ? 1 : 0),
    over: over.item.id,
    position: after ? "after" : "before",
  });
  const into = (first: boolean): TreeMoveTarget => ({
    parentId: over.item.id,
    index: first ? 0 : without(over.item.children ?? []).length,
    over: over.item.id,
    position: "into",
  });
  const intoParent = (): TreeMoveTarget => ({
    ...beside(true),
    position: "into",
  });
  // The group already stands there, together and in this order.
  const unchanged = (target: TreeMoveTarget) => {
    const now = childrenOf(items, target.parentId) ?? [];
    const rest = without(now);
    const after = [
      ...rest.slice(0, target.index),
      ...moved,
      ...rest.slice(target.index),
    ];
    return (
      after.length === now.length && after.every((n, i) => n.id === now[i]?.id)
    );
  };

  const candidates: TreeMoveTarget[] = [];
  if (zone === undefined) {
    if (over.branch) candidates.push(into(false), beside(true));
    else candidates.push(beside(true), intoParent());
  } else {
    if (zone === "top") candidates.push(beside(false));
    else if (zone === "middle") candidates.push(into(false));
    else {
      // Below an open branch whose children show, "after" reads as first
      // among them: the line sits between the branch and its first child.
      const next = rows[overIndex + 1];
      candidates.push(
        over.expanded && next?.parentId === over.item.id
          ? into(true)
          : beside(true),
      );
    }
    if (over.branch) candidates.push(into(false));
    candidates.push(intoParent());
  }

  const seen = new Set<string>();
  for (const target of candidates) {
    const key = `${target.parentId}/${target.index}/${target.position}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const parentId = target.parentId;
    if (parentId !== undefined && moved.some((m) => contains(m, parentId)))
      continue;
    if (unchanged(target)) continue;
    if (moved.every((m) => canDrop(m, target, moved))) return target;
  }
  return undefined;
}

/**
 * `nodes` with `moved` taken out of wherever they stand and put, together and in order, at
 * `target`. Nodes are rebuilt as `{ ...node, children }`; a subtree the move does not touch is
 * returned as it was.
 */
export function moveNodes<T extends TreeNode<T>>(
  nodes: readonly T[],
  moved: readonly T[],
  target: TreeMoveTarget,
): T[] {
  const ids = new Set(moved.map((m) => m.id));
  const place = (list: readonly T[], parentId: string | undefined): T[] => {
    let changed = false;
    const kept: T[] = [];
    for (const node of list) {
      if (ids.has(node.id)) {
        changed = true;
        continue;
      }
      const children = node.children && place(node.children, node.id);
      if (children && children !== node.children) {
        changed = true;
        kept.push({ ...node, children });
      } else kept.push(node);
    }
    if (parentId === target.parentId) {
      kept.splice(target.index, 0, ...moved);
      return kept;
    }
    return changed ? kept : (list as T[]);
  };
  return place(nodes, undefined);
}
