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
