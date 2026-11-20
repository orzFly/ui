import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";

import { isPlainPress } from "../lib/link.ts";
import {
  ancestorsOf,
  matchAncestors,
  moveTarget,
  outermost,
  type TreeDropZone,
  type TreeFilterMode,
  type TreeLoadingRow,
  type TreeMoveTarget,
  type TreeNode,
  type TreeRow,
  visibleRows,
} from "../lib/tree-rows.ts";
import {
  maxPins,
  mountedSegments,
  pinnedRows,
  revealTop,
  TREE_INITIAL_ROWS,
  TREE_VIRTUALIZE_ABOVE,
  type TreeSegment,
  type TreeView,
  windowRange,
} from "../lib/tree-window.ts";
import { cn } from "../lib/utils.ts";
import { Button } from "./button.tsx";
import { SelectSlot } from "./checkbox.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./dropdown-menu.tsx";
import { Input } from "./input.tsx";
import { Popover, PopoverAnchor, PopoverContent } from "./popover.tsx";
import { Skeleton } from "./skeleton.tsx";

/** What a row's render function knows about the row it draws. */
export interface TreeRowState {
  level: number;
  branch: boolean;
  expanded: boolean;
  current: boolean;
  /** The filter matches the row's node. */
  match: boolean;
  /** The row is drawn as a pinned copy at the top, not in its place. */
  pinned: boolean;
  /** The row is in a `selectable` tree's selection. */
  selected: boolean;
}

type TreeAlign = "nearest" | "start" | "center";

/** Scrolling a tree on the app's word. */
export interface TreeHandle {
  /**
   * Opens the way to `id` and scrolls its row into sight below the pins. Moves neither the
   * focus nor `current`; does nothing for an id the tree does not hold.
   */
  scrollToItem(id: string, align?: TreeAlign): void;
  /** Opens the rename field on `id`: its ancestors open, it scrolls into view, the field takes the focus. */
  rename(id: string): void;
}

/** What a row's menu can do to its row, each present only when the tree can do it there. */
export interface TreeMenuActions<T> {
  /**
   * What the menu acts on: the whole selection, less what a selected branch already holds,
   * when the menu's row is selected; otherwise the row alone.
   */
  items: readonly T[];
  /** Adds the row to the selection, in a `selectable` tree, while it is not selected. */
  select?: () => void;
  /** Takes the row out of the selection while it is selected. */
  deselect?: () => void;
  /** Empties the selection while it holds anything. */
  clearSelection?: () => void;
  /** Opens the rename field, when `items` is the row alone and it can be renamed. */
  rename?: () => void;
  /** Cuts `items`, when each of them can be dragged. */
  cut?: () => void;
  /** Moves what is cut to this row, when it can go there. */
  paste?: () => void;
}

export interface TreeLabels {
  /** The rename field's name. Default `Rename ${name}`. */
  renameItem: (name: string) => string;
  /** raymond's balloon heading over a refused name. Default `Cannot rename ${name}`. */
  renameFailed: (name: string) => string;
  /** The ⋯ button's name. Default `Actions for ${name}`. */
  rowActions: (name: string) => string;
}

const LABELS: TreeLabels = {
  renameItem: (name) => `Rename ${name}`,
  renameFailed: (name) => `Cannot rename ${name}`,
  rowActions: (name) => `Actions for ${name}`,
};

interface RowContext {
  row: TreeRow<unknown>;
  pinned: boolean;
  current: boolean;
  currentToken: "page" | "location";
  tabStop: boolean;
  busy: boolean;
  /** A grouping node takes `draggable`; a link drags already. */
  draggable: boolean;
  menu: boolean;
  selectable: boolean;
  selected: boolean;
  register: (id: string, el: HTMLElement | null) => void;
  activate: (event: React.MouseEvent<HTMLElement>, place: boolean) => void;
}

const TreeRowContext = React.createContext<RowContext | null>(null);

/** How long typed characters add up to one search, as the APG's tree view waits. */
const TYPEAHEAD_MS = 500;
/** How long a drag rests on a closed branch before it opens. */
const HOVER_OPEN_MS = 700;
/** The band along the scroller's edges where a drag scrolls it, and its top speed per frame. */
const EDGE_PX = 40;
const EDGE_SPEED = 18;
/** The type a drag from a tree carries, so a tree knows its own drags from any other. */
const DRAG_TYPE = "application/x-orz-tree";

/** The label's text, the name a row shows when the app gives no `textValue`. */
const labelText = (el: Element | null | undefined) =>
  (
    (el?.querySelector("[data-slot=tree-label]") ?? el)?.textContent ?? ""
  ).trim();

const idOf = (row: TreeRow<unknown>) => (row.item as TreeNode<unknown>).id;

function nodeOf<T extends TreeNode<T>>(
  nodes: readonly T[],
  id: string,
): T | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const below = node.children && nodeOf(node.children, id);
    if (below) return below;
  }
  return undefined;
}

/**
 * The nearest ancestor that scrolls, or none when the document does. Looked
 * up each time rather than kept, as the tree may have moved.
 */
function scrollerOf(tree: HTMLElement): HTMLElement | undefined {
  const body = tree.ownerDocument.body;
  for (let el = tree.parentElement; el && el !== body; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay"
    )
      return el;
  }
  return undefined;
}

/**
 * Where the scroller's viewport lies over the rows, read from the rectangles
 * each time rather than kept as an offset, so content above the tree growing
 * or shrinking puts nothing out of step.
 */
function viewOf(
  tree: HTMLElement,
  scroller: HTMLElement | undefined,
): TreeView {
  const rect = tree.getBoundingClientRect();
  // The rows start inside the tree's own border and padding.
  const rowsTop =
    rect.top +
    tree.clientTop +
    (Number.parseFloat(getComputedStyle(tree).paddingTop) || 0);
  if (!scroller) {
    return {
      top: -rowsTop,
      height: tree.ownerDocument.defaultView?.innerHeight ?? 0,
    };
  }
  return {
    top: scroller.getBoundingClientRect().top + scroller.clientTop - rowsTop,
    height: scroller.clientHeight,
  };
}

/** An icon's width, the room a selectable tree keeps before a label with none. */
const ICON_PX = 16;

/**
 * Where a row's leading icon stands, across: the item's first child, or the room a selectable
 * tree keeps before a label that leads. Viewport coordinates, with the item's gap.
 */
function iconPlace(row: Element) {
  const item = row.querySelector("[data-slot=tree-item]");
  const first = item?.firstElementChild;
  if (!item || !first) return undefined;
  const gap = Number.parseFloat(getComputedStyle(item).columnGap) || 0;
  const rect = first.getBoundingClientRect();
  if (first.getAttribute("data-slot") === "tree-label") {
    const right = rect.left - gap;
    return { left: right - ICON_PX, right, gap };
  }
  return { left: rect.left, right: rect.right, gap };
}

/** Whether a point is on a row's icon, or within half a gap of it, at the row's full height. */
function iconHit(row: Element, x: number, y: number) {
  const place = iconPlace(row);
  if (!place) return false;
  const rect = row.getBoundingClientRect();
  return (
    x >= place.left - place.gap / 2 &&
    x <= place.right + place.gap / 2 &&
    y >= rect.top &&
    y <= rect.bottom
  );
}

/** A real row's height, or 0 with none mounted or no layout. */
const measureRow = (tree: HTMLElement) =>
  tree
    .querySelector("[data-slot=tree-row]:not([data-pinned])")
    ?.getBoundingClientRect().height ?? 0;

/**
 * The part of the tree on screen and its rows' height, followed through the
 * scroller's scrolling and every resize while `enabled`, and `undefined`
 * until measured. `update` reads them again at once, after a scroll the tree
 * made itself, so no frame paints the rows of the place it left.
 */
function useTreeViewport(
  tree: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const [view, setView] = React.useState<TreeView>();
  const [rowHeight, setRowHeight] = React.useState<number>();
  const update = React.useRef(() => {});

  React.useLayoutEffect(() => {
    const el = tree.current;
    if (!enabled || !el) return;
    const scroller = scrollerOf(el);
    const read = () => {
      const next = viewOf(el, scroller);
      setView((prev) =>
        prev?.top === next.top && prev.height === next.height ? prev : next,
      );
      const height = measureRow(el);
      if (height > 0) setRowHeight(height);
    };
    update.current = read;
    read();
    const win = el.ownerDocument.defaultView ?? window;
    const target = scroller ?? win;
    target.addEventListener("scroll", read, { passive: true });
    win.addEventListener("resize", read);
    // The tree's height follows its rows', so a change of style or pointer
    // that resizes them is heard here too.
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(read);
    observer?.observe(el);
    if (scroller) observer?.observe(scroller);
    return () => {
      target.removeEventListener("scroll", read);
      win.removeEventListener("resize", read);
      observer?.disconnect();
      update.current = () => {};
    };
  }, [tree, enabled]);

  // The first rows mount unmeasured; they are measured before they paint.
  React.useLayoutEffect(() => {
    const el = tree.current;
    if (!enabled || !el) return;
    const height = measureRow(el);
    if (height > 0) setRowHeight(height);
  });

  return {
    view: enabled ? view : undefined,
    rowHeight: enabled ? rowHeight : undefined,
    update: () => update.current(),
  };
}

/**
 * Places nested as deep as their data goes, each branch opened and closed by the reader: an
 * app's folders, a host's machines, a file's parts. `items` are the roots, each a `TreeNode`;
 * `children` renders a `TreeItem` for each node on screen, the tree drawing the indent, the
 * toggle and the lines around it. Name it with `aria-label` or `aria-labelledby`, put it in a
 * `nav`, and frame that with `NavListFrame` when it is a pane of the app.
 *
 * `current` is the id of the place on screen: its ancestors open when it changes, and it takes
 * the keyboard first. `expanded` with `onExpandedChange` holds the open branches, or
 * `defaultExpanded` seeds them. A branch with `hasChildren` and no `children` calls
 * `onExpandedChange` when opened and shows a row reading `loadingLabel` until its children
 * come. `filter` shows the nodes it matches and their ancestors, opened, and nothing else; with
 * `filterMode` `"expand"` every node stays, the matches' ancestors opened as well as the reader's
 * own branches, and with `"collapse"` only theirs. In those two the reader opens and closes
 * branches for the search alone, and clearing the filter brings back the branches from before.
 * Each new `filter` function is a new search, so memoize it.
 *
 * The tree scrolls in its nearest scrolling ancestor, or the page. `virtualize` mounts only the
 * rows near the screen, by default once a few hundred rows show; the browser's find in page
 * sees no others. Typing a row's first letters jumps to it, read from `textValue` when given and
 * otherwise from the mounted rows' `TreeLabel`. `stickyBranches` pins the open branches above
 * the rows on screen to the top as copies for the pointer; the keyboard and a screen reader stay
 * on the real rows. `current` scrolls into sight in the scrolling ancestor, never the page,
 * unless `revealCurrent` is false. `handle` takes a `TreeHandle` to scroll to a row, the page
 * included.
 *
 * The tree changes no data of its own. `onRename` lets the reader rename a row in place (F2,
 * the menu's `rename`, `handle.rename`), the field starting from `renameValue` with
 * `renameSelection` selected and showing what `validateName` says against a name. `onMove` lets
 * the reader drag rows, or cut and paste them, to a `TreeMoveTarget` that `canDrop` accepts for
 * each; it hears the whole group at once. `menu` draws a ⋯ button at each row's end that opens
 * the items it returns, and Shift+F10 and the menu key open it on the focused row; a right click
 * stays the browser's. `onRename` may return the row's new id and `onMove` the moved rows', which
 * the focus and the selection follow.
 *
 * `selectable` lets the reader select several rows, held in `selected` with `onSelectedChange`
 * or seeded by `defaultSelected`, in the order they show. A checkbox stands in for a row's icon
 * under the pointer and on a selected row; Space, Shift with the arrows and Ctrl/⌘+A select from
 * the keyboard, and the menu's `select` on touch, after which a tap toggles a row. A click on a
 * row's name still goes to its place. Dragging a selected row, cutting it or opening its menu
 * acts on the whole selection; a row that leaves the screen leaves the selection.
 * `onShownChange` hands over the rows on screen, which a select-all takes.
 */
function Tree<T extends TreeNode<T>>({
  items,
  children,
  current,
  currentToken = "page",
  expanded: expandedProp,
  defaultExpanded,
  onExpandedChange,
  filter,
  filterMode = "hide",
  loadingLabel = "Loading…",
  virtualize = "auto",
  stickyBranches = false,
  textValue,
  revealCurrent = true,
  handle,
  onRename,
  canRename,
  renameValue,
  renameSelection,
  validateName,
  onMove,
  canDrag,
  canDrop,
  menu,
  selectable = false,
  selected: selectedProp,
  defaultSelected,
  onSelectedChange,
  onShownChange,
  labels: labelsProp,
  className,
  onKeyDown,
  onFocus,
  onBlur,
  onContextMenu,
  onPointerMove,
  onPointerLeave,
  onPointerDownCapture,
  onClickCapture,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  ref,
  ...props
}: Omit<React.ComponentProps<"div">, "children" | "role"> & {
  items: readonly T[];
  children: (item: T, row: TreeRowState) => React.ReactNode;
  current?: string;
  currentToken?: "page" | "location";
  expanded?: readonly string[];
  defaultExpanded?: readonly string[];
  onExpandedChange?: (expanded: string[]) => void;
  filter?: (item: T) => boolean;
  filterMode?: TreeFilterMode;
  loadingLabel?: string;
  virtualize?: "auto" | boolean;
  stickyBranches?: boolean;
  textValue?: (item: T) => string;
  revealCurrent?: boolean;
  handle?: React.Ref<TreeHandle>;
  /** Called with the trimmed name, never an empty or unchanged one; may return the new id. */
  // biome-ignore lint/suspicious/noConfusingVoidType: a callback that changes no id returns nothing
  onRename?: (item: T, name: string) => string | void;
  canRename?: (item: T) => boolean;
  renameValue?: (item: T) => string;
  /** The `[start, end]` selected when the field opens; all of it by default. */
  renameSelection?: (item: T, value: string) => readonly [number, number];
  validateName?: (item: T, name: string) => string | undefined;
  /** Called with the items in the order they show; may return their new ids, in that order. */
  // biome-ignore lint/suspicious/noConfusingVoidType: as onRename
  onMove?: (
    items: readonly T[],
    target: TreeMoveTarget,
  ) => readonly string[] | void;
  canDrag?: (item: T) => boolean;
  /** Asked for each item of the group a move takes, which `group` holds whole. */
  canDrop?: (item: T, target: TreeMoveTarget, group: readonly T[]) => boolean;
  menu?: (item: T, actions: TreeMenuActions<T>) => React.ReactNode;
  selectable?: boolean;
  selected?: readonly string[];
  defaultSelected?: readonly string[];
  onSelectedChange?: (selected: string[]) => void;
  /** Called with the ids of the rows on screen, in order, each time they change. */
  onShownChange?: (shown: string[]) => void;
  labels?: Partial<TreeLabels>;
}) {
  // Opened to the current place in the first render, so a page rendered on
  // the server already shows it.
  const [inner, setInner] = React.useState<ReadonlySet<string>>(
    () =>
      new Set([
        ...(defaultExpanded ?? []),
        ...((current !== undefined && ancestorsOf(items, current)) || []),
      ]),
  );
  const controlled = expandedProp !== undefined;
  const expanded = React.useMemo(
    () => (expandedProp ? new Set(expandedProp) : inner),
    [expandedProp, inner],
  );
  // The branches open for the search alone. Worked out in the render a new
  // search starts, not an effect after it, so no frame shows the old ones.
  const [search, setSearch] = React.useState<{
    filter: (item: T) => boolean;
    mode: TreeFilterMode;
    open: ReadonlySet<string>;
  }>();
  const locked = filter !== undefined && filterMode === "hide";
  let searchOpen: ReadonlySet<string> | undefined;
  if (filter && !locked) {
    if (search?.filter === filter && search.mode === filterMode) {
      searchOpen = search.open;
    } else {
      const ancestors = matchAncestors(items, filter);
      searchOpen = new Set(
        filterMode === "expand" ? [...expanded, ...ancestors] : ancestors,
      );
      setSearch({ filter, mode: filterMode, open: searchOpen });
    }
  } else if (search) {
    setSearch(undefined);
  }
  const shown = searchOpen ?? expanded;
  const rows = React.useMemo(
    () => visibleRows(items, shown, filter, filterMode),
    [items, shown, filter, filterMode],
  );
  const itemRows = React.useMemo(
    () => rows.filter((r): r is TreeRow<T> => r.kind === "item"),
    [rows],
  );
  const indexOf = React.useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r, i) => {
      if (r.kind === "item") map.set(r.item.id, i);
    });
    return map;
  }, [rows]);

  const [innerSelected, setInnerSelected] = React.useState<ReadonlySet<string>>(
    () => new Set(defaultSelected),
  );
  const selection = React.useMemo(
    () => (selectedProp ? new Set(selectedProp) : innerSelected),
    [selectedProp, innerSelected],
  );
  // Only a row on screen is selected; the rest are handed back below.
  const shownSelection = React.useMemo(
    () =>
      new Set(selectable ? [...selection].filter((id) => indexOf.has(id)) : []),
    [selectable, selection, indexOf],
  );
  // Shift's range runs from the anchor, over the selection as it was when
  // the anchor was set.
  const anchor = React.useRef<{ id: string; base: ReadonlySet<string> }>(
    undefined,
  );
  const [iconHover, setIconHover] = React.useState<string>();
  const pointerType = React.useRef("");

  const root = React.useRef<HTMLDivElement>(null);
  const setRoot = React.useCallback(
    (el: HTMLDivElement | null) => {
      root.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );
  const virtual =
    virtualize === true ||
    (virtualize === "auto" && rows.length > TREE_VIRTUALIZE_ABOVE);
  const viewport = useTreeViewport(root, virtual || stickyBranches);

  const [focusId, setFocusId] = React.useState<string>();
  const elements = React.useRef(new Map<string, HTMLElement>()).current;
  // Focus waits for the commit that renders the row it moves to.
  const pendingFocus = React.useRef<string>(undefined);
  // A scroll waits for the commit that opens the way to its row.
  const pendingReveal = React.useRef<{
    id: string;
    align: TreeAlign;
    page: boolean;
  }>(undefined);
  const typed = React.useRef({ text: "", at: 0 });

  const labels = { ...LABELS, ...labelsProp };
  const [renaming, setRenaming] = React.useState<string>();
  // A rename asked for before its row shows, until a commit opens the way.
  const pendingRename = React.useRef<string>(undefined);
  const [cut, setCut] = React.useState<readonly string[]>();
  const [menuFor, setMenuFor] = React.useState<string>();
  // A menu's rename waits for the menu to close, which would take the focus
  // back from the field.
  const renameAfterMenu = React.useRef<string>(undefined);
  // A Shift+F10 or menu key the browser follows with a contextmenu event.
  const keyMenu = React.useRef(false);
  const [hasFocus, setHasFocus] = React.useState(false);
  // An id a rename or a move gave the row, which the focus waits for; not
  // pendingFocus, which moves to a row the tree already holds.
  const follow = React.useRef<{
    id: string;
    focus: boolean;
    items: readonly T[];
  }>(undefined);
  // The ids a move or a rename gave selected rows, put into the selection
  // once the items holding them arrive.
  const renamed = React.useRef<{
    ids: ReadonlyMap<string, string>;
    /** The selection as the move or rename found it. */
    selection: ReadonlySet<string>;
    items: readonly T[];
  }>(undefined);
  const dragToken = React.useId();
  const drag = React.useRef<{
    /** The row the drag started on. */
    from: string;
    sources: readonly string[];
    y: number;
    hover?: { key: string; timer: ReturnType<typeof setTimeout> };
    frame?: number;
    image?: HTMLElement;
  }>(undefined);
  const [dragSource, setDragSource] = React.useState<readonly string[]>();
  const [drop, setDrop] = React.useState<{
    target: TreeMoveTarget;
    /** The row whose upper edge takes the line for a drop first into an open branch. */
    first?: string;
  }>();
  const pinsBottom = React.useRef(0);

  const visible = (id: string | undefined) =>
    id !== undefined && itemRows.some((r) => r.item.id === id);
  const tabStop = visible(focusId)
    ? focusId
    : visible(current)
      ? current
      : (itemRows.find((r) => r.match) ?? itemRows[0])?.item.id;

  // A row leaving the screen takes its rename, cut and menu with it; seen in
  // the render, as a new search is, so no frame draws them on nothing.
  if (renaming !== undefined && !indexOf.has(renaming)) setRenaming(undefined);
  if (cut?.some((id) => !indexOf.has(id))) setCut(undefined);
  if (menuFor !== undefined && !indexOf.has(menuFor)) setMenuFor(undefined);

  const itemOf = (id: string) => {
    const row = rows[indexOf.get(id) ?? -1];
    return row?.kind === "item" ? row.item : undefined;
  };
  const itemsOf = (ids: readonly string[] | undefined) => {
    const found = (ids ?? []).flatMap((id) => itemOf(id) ?? []);
    return ids && found.length === ids.length && found.length > 0
      ? found
      : undefined;
  };
  const renamable = (item: T) =>
    onRename !== undefined && canRename?.(item) !== false;
  const movable = (item: T) =>
    onMove !== undefined && canDrag?.(item) !== false;
  const accepts = (item: T, target: TreeMoveTarget, group: readonly T[]) =>
    canDrop?.(item, target, group) ?? true;

  const inShowOrder = (ids: Iterable<string>) =>
    [...ids]
      .filter((id) => indexOf.has(id))
      .sort((a, b) => (indexOf.get(a) ?? 0) - (indexOf.get(b) ?? 0));

  const setSelection = (next: Iterable<string>) => {
    const ids = inShowOrder(next);
    if (selectedProp === undefined) setInnerSelected(new Set(ids));
    onSelectedChange?.(ids);
  };

  // What a select-all over the tree (a SelectionBar's) takes, and how many.
  const shownKey = React.useRef<string>(undefined);
  React.useEffect(() => {
    if (!onShownChange) return;
    const ids = itemRows.map((r) => r.item.id);
    const key = ids.join("\0");
    if (key === shownKey.current) return;
    shownKey.current = key;
    onShownChange(ids);
  });

  // An id that left the screen leaves the selection, once per selection the
  // tree is given, so an app that does not take it back is not asked again.
  const pruned = React.useRef<ReadonlySet<string>>(undefined);
  const skipPrune = React.useRef(false);
  React.useEffect(() => {
    if (skipPrune.current) {
      skipPrune.current = false;
      return;
    }
    if (!selectable || pruned.current === selection) return;
    if (shownSelection.size === selection.size) return;
    pruned.current = selection;
    if (selectedProp === undefined) setInnerSelected(shownSelection);
    onSelectedChange?.(inShowOrder(shownSelection));
  });

  // What dragging, cutting or the menu on a row acts on: the selection when
  // the row is in it, less what a selected branch holds, or the row alone.
  const targetsOf = (id: string): T[] => {
    const item = itemOf(id);
    if (!item) return [];
    if (!shownSelection.has(id)) return [item];
    return outermost(
      inShowOrder(shownSelection).flatMap((s) => itemOf(s) ?? []),
    );
  };

  const toggleSelected = (id: string) => {
    const next = new Set(shownSelection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    anchor.current = { id, base: next };
    setSelection(next);
  };

  // The anchor's selection with every row from the anchor to `to` set to
  // `on`. With no anchor on screen, `from` is one.
  const selectRange = (to: string, on: boolean, from: string) => {
    let start = anchor.current;
    if (!start || !indexOf.has(start.id)) {
      start = { id: from, base: shownSelection };
      anchor.current = start;
    }
    const a = indexOf.get(start.id) ?? 0;
    const b = indexOf.get(to) ?? 0;
    const next = new Set(start.base);
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
      const row = rows[i];
      if (row?.kind !== "item") continue;
      if (on) next.add(row.item.id);
      else next.delete(row.item.id);
    }
    setSelection(next);
  };

  const commit = (next: Set<string>) => {
    if (!controlled) setInner(next);
    onExpandedChange?.([...next]);
  };

  // While searching, the search's own branches change; a branch opened with
  // its children still to load opens for the reader too, so the app hears
  // to load them.
  const change = (next: Set<string>) => {
    if (!search || !searchOpen) {
      commit(next);
      return;
    }
    const before = searchOpen;
    setSearch({ ...search, open: next });
    const unloaded = itemRows
      .filter(
        (r) =>
          next.has(r.item.id) &&
          !before.has(r.item.id) &&
          !expanded.has(r.item.id) &&
          r.item.hasChildren === true &&
          r.item.children === undefined,
      )
      .map((r) => r.item.id);
    if (unloaded.length > 0) commit(new Set([...expanded, ...unloaded]));
  };

  const focusInTree = () =>
    [...elements.values()].some((el) => el === el.ownerDocument.activeElement);

  const moveFocus = (id: string) => {
    setFocusId(id);
    pendingFocus.current = id;
  };

  const setOpen = (id: string, open: boolean) => {
    if (shown.has(id) === open) return;
    const next = new Set(shown);
    if (open) next.add(id);
    else {
      next.delete(id);
      // The focused row is going out of sight with the branch: the focus
      // stays in reach on the branch itself.
      const at = focusId ?? tabStop;
      if (at !== undefined && ancestorsOf(items, at)?.includes(id)) {
        setFocusId(id);
        if (focusInTree()) pendingFocus.current = id;
      }
    }
    change(next);
  };

  const scrollBy = (
    el: HTMLElement,
    scroller: HTMLElement | undefined,
    by: number,
  ) => {
    if (by === 0) return;
    if (scroller) scroller.scrollTop += by;
    else el.ownerDocument.defaultView?.scrollBy({ top: by });
    viewport.update();
  };

  // Scrolls the one scroller, never through scrollIntoView, which moves every
  // scrolling ancestor too; the page only when `page` says so.
  const reveal = (id: string, align: TreeAlign, page: boolean) => {
    const el = root.current;
    const index = indexOf.get(id);
    if (!el || index === undefined) return;
    const height = viewport.rowHeight ?? measureRow(el);
    if (!(height > 0)) return;
    const scroller = scrollerOf(el);
    if (!scroller && !page) return;
    const view = viewOf(el, scroller);
    const ancestors = (rows[index]?.level ?? 1) - 1;
    const inset = stickyBranches
      ? Math.min(ancestors, maxPins(height, view.height)) * height
      : 0;
    const top = revealTop(index, height, view, inset, align);
    if (top !== undefined) scrollBy(el, scroller, top - view.top);
  };

  React.useLayoutEffect(() => {
    const id = pendingFocus.current;
    if (id === undefined) return;
    pendingFocus.current = undefined;
    const el = elements.get(id);
    if (!el) return;
    el.focus({ preventScroll: true });
    reveal(id, "nearest", true);
  });

  React.useLayoutEffect(() => {
    if (revealCurrent && current !== undefined) {
      pendingReveal.current = { id: current, align: "nearest", page: false };
    }
  }, [current, revealCurrent]);

  React.useLayoutEffect(() => {
    const pending = pendingReveal.current;
    if (!pending || !indexOf.has(pending.id)) return;
    pendingReveal.current = undefined;
    reveal(pending.id, pending.align, pending.page);
  });

  // Opens the way to the row first, as scrollToItem does; the field mounts
  // once the row shows.
  const startRename = (id: string) => {
    const item = nodeOf(items, id);
    if (!item || !renamable(item)) return;
    setMenuFor(undefined);
    if (indexOf.has(id)) {
      reveal(id, "nearest", true);
      setRenaming(id);
      return;
    }
    const missing = (ancestorsOf(items, id) ?? []).filter((a) => !shown.has(a));
    if (locked || missing.length === 0) return;
    pendingRename.current = id;
    pendingReveal.current = { id, align: "nearest", page: true };
    change(new Set([...shown, ...missing]));
  };

  React.useLayoutEffect(() => {
    const id = pendingRename.current;
    if (id === undefined || !indexOf.has(id)) return;
    pendingRename.current = undefined;
    setRenaming(id);
  });

  // The focus, kept in the tree only if it was there, goes where the row
  // went: under its new id, or its own.
  const followTo = (id: string, focus: boolean) => {
    follow.current = { id, focus, items };
  };

  React.useLayoutEffect(() => {
    const next = follow.current;
    if (!next) return;
    if (indexOf.has(next.id)) {
      follow.current = undefined;
      if (next.focus) moveFocus(next.id);
      else setFocusId(next.id);
    } else if (next.items !== items) {
      follow.current = undefined;
    }
  });

  // Ahead of the pruning effect, which would otherwise drop the old ids
  // in the same commit.
  React.useLayoutEffect(() => {
    const next = renamed.current;
    if (!next || next.items === items) return;
    renamed.current = undefined;
    skipPrune.current = true;
    setSelection([...next.selection].map((id) => next.ids.get(id) ?? id));
  });

  const renameSelected = (from: readonly string[], to: readonly string[]) => {
    const ids = new Map<string, string>();
    from.forEach((id, i) => {
      const now = to[i];
      if (shownSelection.has(id) && now !== undefined && now !== id)
        ids.set(id, now);
    });
    if (ids.size > 0)
      renamed.current = { ids, selection: shownSelection, items };
  };

  const finishRename = (
    id: string,
    name: string | undefined,
    focus: boolean,
  ) => {
    setRenaming(undefined);
    const item = itemOf(id);
    const next =
      item && name !== undefined ? onRename?.(item, name) : undefined;
    const to = typeof next === "string" ? next : id;
    renameSelected([id], [to]);
    followTo(to, focus);
  };

  // `from` is the row the focus follows: where the drag started, or the
  // focused row a paste was made on.
  const move = (group: readonly T[], target: TreeMoveTarget, from: string) => {
    const next = onMove?.(group, target);
    const ids = group.map((item) => item.id);
    const to = Array.isArray(next) ? (next as readonly string[]) : ids;
    renameSelected(ids, to);
    const at = ids.indexOf(from);
    followTo((at < 0 ? undefined : to[at]) ?? from, focusInTree());
  };

  const paste = (overId: string, from: string) => {
    const sources = itemsOf(cut);
    const index = indexOf.get(overId);
    if (!sources || index === undefined) return false;
    const target = moveTarget(rows, items, sources, index, undefined, accepts);
    if (!target) return false;
    setCut(undefined);
    move(sources, target, from);
    return true;
  };

  // Cuts what the row acts on, when every part of it can move.
  const cutFrom = (id: string) => {
    const group = targetsOf(id);
    if (group.length === 0 || !group.every(movable)) return false;
    setCut(group.map((item) => item.id));
    return true;
  };

  const actionsFor = (item: T): TreeMenuActions<T> => {
    const sources = itemsOf(cut);
    const index = indexOf.get(item.id);
    const group = targetsOf(item.id);
    const isSelected = shownSelection.has(item.id);
    return {
      items: group,
      select:
        selectable && !isSelected
          ? () => {
              anchor.current = undefined;
              setSelection([...shownSelection, item.id]);
            }
          : undefined,
      deselect: isSelected
        ? () => {
            anchor.current = undefined;
            setSelection([...shownSelection].filter((s) => s !== item.id));
          }
        : undefined,
      clearSelection:
        shownSelection.size > 0
          ? () => {
              anchor.current = undefined;
              setSelection([]);
            }
          : undefined,
      rename:
        group.length === 1 && group[0] === item && renamable(item)
          ? () => {
              renameAfterMenu.current = item.id;
            }
          : undefined,
      cut: group.every(movable) ? () => cutFrom(item.id) : undefined,
      paste:
        sources &&
        index !== undefined &&
        moveTarget(rows, items, sources, index, undefined, accepts)
          ? () => paste(item.id, item.id)
          : undefined,
    };
  };

  const latest = React.useRef({
    items,
    expanded,
    commit,
    indexOf,
    reveal,
    startRename,
    setOpen,
  });
  latest.current = {
    items,
    expanded,
    commit,
    indexOf,
    reveal,
    startRename,
    setOpen,
  };

  React.useImperativeHandle(
    handle,
    () => ({
      rename(id) {
        latest.current.startRename(id);
      },
      scrollToItem(id, align = "nearest") {
        const { items, expanded, commit, indexOf, reveal } = latest.current;
        const ancestors = ancestorsOf(items, id);
        if (!ancestors) return;
        const missing = ancestors.filter((a) => !expanded.has(a));
        if (missing.length === 0 && indexOf.has(id)) {
          reveal(id, align, true);
          return;
        }
        pendingReveal.current = { id, align, page: true };
        if (missing.length > 0) commit(new Set([...expanded, ...missing]));
      },
    }),
    [],
  );

  // Opens the way to the current place each time it changes, and only then:
  // a branch the reader closes afterwards stays closed.
  React.useEffect(() => {
    if (current === undefined) return;
    const { items, expanded, commit } = latest.current;
    const missing = (ancestorsOf(items, current) ?? []).filter(
      (id) => !expanded.has(id),
    );
    if (missing.length > 0) commit(new Set([...expanded, ...missing]));
  }, [current]);

  const register = React.useCallback(
    (id: string, el: HTMLElement | null) => {
      if (el) elements.set(id, el);
      else elements.delete(id);
    },
    [elements],
  );

  // A pin closing its branch leaves the branch's own row where the pin was,
  // under the pointer, rather than wherever the scroll position puts it.
  const closeFromPin = (row: TreeRow<T>, slotTop: number) => {
    const el = root.current;
    const index = indexOf.get(row.item.id);
    const height = viewport.rowHeight;
    if (el && index !== undefined && height) {
      const scroller = scrollerOf(el);
      const view = viewOf(el, scroller);
      scrollBy(el, scroller, index * height - view.top - slotTop);
    }
    setOpen(row.item.id, false);
  };

  const activate = (
    row: TreeRow<T>,
    event: React.MouseEvent<HTMLElement>,
    place: boolean,
    pin: number | undefined,
  ) => {
    setFocusId(row.item.id);
    if (locked || !row.branch) return;
    if (!place) {
      if (pin !== undefined && row.expanded) closeFromPin(row, pin);
      else setOpen(row.item.id, !row.expanded);
      return;
    }
    // isPlainPress, not isPlainClick: a link that opens in place, or a
    // router's link, has already called preventDefault by now.
    if (isPlainPress(event)) setOpen(row.item.id, true);
  };

  const toggle = (row: TreeRow<T>, pin: number | undefined) => {
    if (locked) return;
    if (pin !== undefined && row.expanded) closeFromPin(row, pin);
    else setOpen(row.item.id, !row.expanded);
    if (focusInTree()) moveFocus(row.item.id);
    else setFocusId(row.item.id);
  };

  const rowText = (row: TreeRow<T>) => {
    if (textValue) return textValue(row.item).trim().toLowerCase();
    const el = elements.get(row.item.id);
    const label = el?.querySelector("[data-slot=tree-label]") ?? el;
    return (label?.textContent ?? "").trim().toLowerCase();
  };

  // However a row got the focus, it is the one kept mounted and the tab stop.
  const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    onFocus?.(event);
    setHasFocus(true);
    for (const [id, el] of elements) {
      if (el === event.target) {
        if (id !== focusId) setFocusId(id);
        return;
      }
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    onBlur?.(event);
    const to = event.relatedTarget;
    if (!(to instanceof Node && root.current?.contains(to))) setHasFocus(false);
  };

  const idAt = (target: EventTarget | null) => {
    const el =
      target instanceof Element
        ? target.closest("[data-slot=tree-item]")
        : null;
    for (const [id, item] of elements) if (item === el) return id;
    return undefined;
  };

  // A right click is the link's, the browser's menu; only the keyboard's
  // contextmenu opens the row's. A Mac's control-click is a right click.
  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    onContextMenu?.(event);
    const fromKey = keyMenu.current;
    keyMenu.current = false;
    if (event.defaultPrevented || !menu) return;
    if (fromKey) {
      event.preventDefault();
      return;
    }
    if (event.button === 2 || event.ctrlKey) return;
    const id = idAt(event.target);
    if (id === undefined) return;
    event.preventDefault();
    setMenuFor(id);
  };

  const rowAt = (target: EventTarget | null) => {
    const el =
      target instanceof Element ? target.closest("[data-slot=tree-row]") : null;
    if (!el || !root.current?.contains(el)) return undefined;
    const id = rowIds.get(el);
    return id === undefined || !indexOf.has(id) ? undefined : { el, id };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    if (!selectable || event.pointerType === "touch") return;
    const at = rowAt(event.target);
    const next =
      at && iconHit(at.el, event.clientX, event.clientY) ? at.id : undefined;
    if (next !== iconHover) setIconHover(next);
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(event);
    if (iconHover !== undefined) setIconHover(undefined);
  };

  const handlePointerDownCapture = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    onPointerDownCapture?.(event);
    pointerType.current = event.pointerType;
  };

  // Ahead of the link's own click, a router link's and the app's: a click
  // on the icon selects, and once a selection is under way a tap toggles.
  // Every other click, and any a modifier or another button makes, is the
  // link's.
  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    onClickCapture?.(event);
    if (!selectable || event.defaultPrevented || event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // Enter on a link clicks it too, with no pointer behind it.
    if (event.detail === 0) return;
    const at = rowAt(event.target);
    if (!at) return;
    const target = event.target as Element;
    if (
      target.closest(
        "[data-slot=tree-toggle], [data-slot=tree-row-menu], [data-slot=tree-rename]",
      )
    )
      return;
    if (pointerType.current === "touch") {
      if (event.shiftKey || shownSelection.size === 0) return;
      toggleSelected(at.id);
    } else {
      if (!iconHit(at.el, event.clientX, event.clientY)) return;
      if (event.shiftKey) {
        const from = focusId ?? tabStop ?? at.id;
        selectRange(at.id, !shownSelection.has(at.id), from);
      } else toggleSelected(at.id);
    }
    event.preventDefault();
    event.stopPropagation();
    if (focusInTree()) moveFocus(at.id);
    else setFocusId(at.id);
  };

  // The keys that rename, open the menu, cut and paste; true when one did.
  const editKey = (event: React.KeyboardEvent, row: TreeRow<T>) => {
    const id = row.item.id;
    const mod = event.ctrlKey || event.metaKey;
    const only = (ctrl: boolean, shift: boolean) =>
      mod === ctrl && event.shiftKey === shift && !event.altKey;
    const letter = event.key.toLowerCase();
    if (event.key === "F2" && only(false, false)) {
      if (!renamable(row.item)) return false;
      startRename(id);
    } else if (
      menu &&
      (event.key === "ContextMenu" ||
        (event.key === "F10" && only(false, true)))
    ) {
      keyMenu.current = true;
      setMenuFor(id);
    } else if (letter === "x" && only(true, false)) {
      if (!cutFrom(id)) return false;
    } else if (letter === "v" && only(true, false)) {
      if (cut === undefined) return false;
      paste(id, id);
    } else if (event.key === "Escape" && cut !== undefined) {
      setCut(undefined);
    } else {
      return false;
    }
    return true;
  };

  // The keys that select, in a selectable tree; true when one did.
  const selectKey = (event: React.KeyboardEvent, index: number) => {
    const row = itemRows[index];
    if (!row) return false;
    const id = row.item.id;
    const mod = event.ctrlKey || event.metaKey;
    if (event.altKey) return false;
    if (event.key === " " && !event.shiftKey) {
      // A space typed into a search for a row's name is part of it.
      const buffer = typed.current;
      const typing =
        buffer.text !== "" && event.timeStamp - buffer.at <= TYPEAHEAD_MS;
      if (typing && !mod) return false;
      toggleSelected(id);
      return true;
    }
    if (mod && !event.shiftKey && event.key.toLowerCase() === "a") {
      const all = itemRows.map((r) => r.item.id);
      anchor.current = { id, base: new Set(all) };
      setSelection(all);
      return true;
    }
    if (event.key === "Escape" && !mod && !event.shiftKey) {
      if (shownSelection.size === 0) return false;
      anchor.current = undefined;
      setSelection([]);
      return true;
    }
    if (!event.shiftKey || mod) return false;
    const to =
      event.key === "ArrowDown"
        ? itemRows[index + 1]
        : event.key === "ArrowUp"
          ? itemRows[index - 1]
          : event.key === "Home"
            ? itemRows[0]
            : event.key === "End"
              ? itemRows.at(-1)
              : undefined;
    if (!to) return ["ArrowDown", "ArrowUp"].includes(event.key);
    moveFocus(to.item.id);
    selectRange(to.item.id, true, id);
    return true;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    keyMenu.current = false;
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const index = itemRows.findIndex(
      (r) => elements.get(r.item.id) === event.target,
    );
    const row = itemRows[index];
    if (!row) return;
    if (editKey(event, row) || (selectable && selectKey(event, index))) {
      event.preventDefault();
      return;
    }
    const id = row.item.id;
    const go = (to: TreeRow<T> | undefined) => {
      if (to) moveFocus(to.item.id);
    };
    const opens = row.branch && !locked;

    switch (event.key) {
      case "ArrowDown":
        go(itemRows[index + 1]);
        break;
      case "ArrowUp":
        go(itemRows[index - 1]);
        break;
      case "Home":
        go(itemRows[0]);
        break;
      case "End":
        go(itemRows.at(-1));
        break;
      case "ArrowRight":
        if (!row.branch) break;
        if (!row.expanded) {
          if (opens) setOpen(id, true);
        } else if (itemRows[index + 1]?.parentId === id) {
          go(itemRows[index + 1]);
        }
        break;
      case "ArrowLeft":
        if (row.expanded && opens) setOpen(id, false);
        else go(itemRows.find((r) => r.item.id === row.parentId));
        break;
      case "*": {
        if (locked) break;
        const next = new Set(shown);
        for (const r of itemRows) {
          if (r.parentId === row.parentId && r.branch) next.add(r.item.id);
        }
        if (next.size !== shown.size) change(next);
        break;
      }
      case "Enter":
        // A link or a button clicks itself; a grouping node has no click.
        if (event.target instanceof HTMLAnchorElement) return;
        if (event.target instanceof HTMLButtonElement) return;
        if (opens) setOpen(id, !row.expanded);
        break;
      default: {
        if (event.key.length !== 1) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const now = event.timeStamp;
        const buffer = typed.current;
        if (now - buffer.at > TYPEAHEAD_MS) buffer.text = "";
        if (buffer.text === "" && event.key === " ") return;
        buffer.text += event.key.toLowerCase();
        buffer.at = now;
        // One character looks past the focused row, so pressing it again
        // steps through the rows it starts; a longer one may still be it.
        const start = buffer.text.length === 1 ? index + 1 : index;
        for (let i = 0; i < itemRows.length; i++) {
          const r = itemRows[(start + i) % itemRows.length];
          if (r && rowText(r).startsWith(buffer.text)) {
            go(r);
            break;
          }
        }
      }
    }
    event.preventDefault();
  };

  const rowIds = React.useRef(new WeakMap<Element, string>()).current;

  // Where a drag over `target` would drop: by the pointer's height on a row,
  // and only into the branch a pinned copy stands for, since its real row is
  // under the pins.
  const dropAt = (target: EventTarget | null, clientY: number): typeof drop => {
    const session = drag.current;
    const source = itemsOf(session?.sources);
    const el =
      target instanceof Element ? target.closest("[data-slot=tree-row]") : null;
    if (!source || !el || !root.current?.contains(el)) return undefined;
    if (el.hasAttribute("data-pinned")) {
      const id = rowIds.get(el);
      const index = id === undefined ? undefined : indexOf.get(id);
      if (index === undefined) return undefined;
      const found = moveTarget(
        rows,
        items,
        source,
        index,
        "middle",
        (item, t, group) =>
          t.position === "into" && t.parentId === id && accepts(item, t, group),
      );
      return found && { target: found };
    }
    const index = Number(el.getAttribute("data-index"));
    const row = rows[index];
    if (!row) return undefined;
    let zone: TreeDropZone = "middle";
    if (row.kind === "item") {
      const rect = el.getBoundingClientRect();
      const y = (clientY - rect.top) / rect.height;
      zone = row.branch
        ? y < 0.25
          ? "top"
          : y > 0.75
            ? "bottom"
            : "middle"
        : y < 0.5
          ? "top"
          : "bottom";
    }
    const found = moveTarget(rows, items, source, index, zone, accepts);
    if (!found) return undefined;
    const next = rows[index + 1];
    const first =
      zone === "bottom" &&
      found.position === "into" &&
      found.parentId === found.over &&
      found.index === 0 &&
      next?.kind === "item" &&
      next.parentId === found.over
        ? next.item.id
        : undefined;
    return { target: found, first };
  };

  const stopHover = () => {
    const session = drag.current;
    if (session?.hover) clearTimeout(session.hover.timer);
    if (session) session.hover = undefined;
  };

  const stopScroll = () => {
    const session = drag.current;
    if (session?.frame !== undefined) cancelAnimationFrame(session.frame);
    if (session) session.frame = undefined;
  };

  // Scrolls while the pointer rests near the scroller's edge, the top one
  // below the pins, faster the nearer it is.
  const edgeScroll = () => {
    const el = root.current;
    const session = drag.current;
    if (!el || !session || session.frame !== undefined) return;
    const step = () => {
      const now = drag.current;
      if (!now) return;
      now.frame = undefined;
      const scroller = scrollerOf(el);
      const top = scroller
        ? scroller.getBoundingClientRect().top + scroller.clientTop
        : 0;
      const bottom = scroller
        ? top + scroller.clientHeight
        : (el.ownerDocument.defaultView?.innerHeight ?? 0);
      const speed = (distance: number) =>
        Math.ceil(((EDGE_PX - Math.max(0, distance)) / EDGE_PX) * EDGE_SPEED);
      const upper = top + pinsBottom.current;
      const by =
        now.y < upper + EDGE_PX
          ? -speed(now.y - upper)
          : now.y > bottom - EDGE_PX
            ? speed(bottom - now.y)
            : 0;
      if (by === 0) return;
      scrollBy(el, scroller, by);
      now.frame = requestAnimationFrame(step);
    };
    session.frame = requestAnimationFrame(step);
  };

  const clearDrop = () => {
    stopHover();
    stopScroll();
    setDrop(undefined);
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    onDragStart?.(event);
    if (event.defaultPrevented || !onMove) return;
    const id = idAt(event.target);
    const item = id === undefined ? undefined : itemOf(id);
    const el = id === undefined ? undefined : elements.get(id);
    const group = id === undefined ? [] : targetsOf(id);
    if (!item || !el || group.length === 0 || !group.every(movable)) return;
    const data = event.dataTransfer;
    // Dragged out of the tree, a row is the link it is.
    const href = el instanceof HTMLAnchorElement ? el.href : "";
    if (href) data.setData("text/uri-list", href);
    data.setData("text/plain", href || (textValue?.(item) ?? labelText(el)));
    data.setData(DRAG_TYPE, dragToken);
    data.effectAllowed = "all";
    // The row as the drag image, drawn off screen; raymond's is its
    // highlighted label.
    const rect = el.getBoundingClientRect();
    const doc = el.ownerDocument;
    const image = doc.createElement("div");
    image.setAttribute("aria-hidden", "true");
    image.className = DRAG_IMAGE;
    image.style.width = `${rect.width}px`;
    if (group.length === 1) {
      image.setAttribute("data-current", "");
      image.style.height = `${rect.height}px`;
      image.append(el.cloneNode(true));
    } else {
      // Several rows: the default style counts them on the one dragged;
      // raymond stacks up to three, unhighlighted, as Explorer does.
      image.classList.add("flex-col");
      const line = (from: HTMLElement, className: string) => {
        const div = doc.createElement("div");
        div.className = className;
        div.style.height = `${rect.height}px`;
        div.append(from.cloneNode(true));
        image.append(div);
        return div;
      };
      const count = doc.createElement("span");
      count.setAttribute("data-slot", "tree-drag-count");
      count.className = DRAG_COUNT;
      count.textContent = String(group.length);
      line(el, "flex items-center").append(count);
      const others = group
        .flatMap((g) => (g.id === id ? [] : (elements.get(g.id) ?? [])))
        .slice(0, 2);
      for (const other of others) line(other, "hidden raymond:flex");
    }
    doc.body.append(image);
    data.setDragImage?.(
      image,
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
    const sources = group.map((g) => g.id);
    drag.current = { from: id as string, sources, y: event.clientY, image };
    setDragSource(sources);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    onDragOver?.(event);
    const session = drag.current;
    // Another tree's drag, a file from the desktop, text from a page: not
    // this tree's to take.
    if (
      event.defaultPrevented ||
      !session ||
      !event.dataTransfer.types.includes(DRAG_TYPE)
    )
      return;
    session.y = event.clientY;
    edgeScroll();
    const found = dropAt(event.target, event.clientY);
    if (!found) {
      stopHover();
      setDrop(undefined);
      event.dataTransfer.dropEffect = "none";
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const { target } = found;
    setDrop((prev) =>
      prev &&
      prev.first === found.first &&
      prev.target.parentId === target.parentId &&
      prev.target.index === target.index &&
      prev.target.over === target.over &&
      prev.target.position === target.position
        ? prev
        : found,
    );
    // Resting on a closed branch the drop goes into opens it.
    const parent =
      target.position === "into" && target.parentId !== undefined
        ? rows[indexOf.get(target.parentId) ?? -1]
        : undefined;
    const opens =
      !locked &&
      parent?.kind === "item" &&
      parent.branch &&
      !parent.expanded &&
      target.parentId;
    if (!opens) stopHover();
    else if (session.hover?.key !== opens) {
      stopHover();
      session.hover = {
        key: opens,
        timer: setTimeout(
          () => latest.current.setOpen(opens, true),
          HOVER_OPEN_MS,
        ),
      };
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    onDragLeave?.(event);
    const to = event.relatedTarget;
    if (drag.current && !(to instanceof Node && root.current?.contains(to)))
      clearDrop();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    onDrop?.(event);
    const session = drag.current;
    if (
      event.defaultPrevented ||
      !session ||
      !event.dataTransfer.types.includes(DRAG_TYPE)
    )
      return;
    event.preventDefault();
    const found = dropAt(event.target, event.clientY);
    const sources = itemsOf(session.sources);
    clearDrop();
    if (found && sources) move(sources, found.target, session.from);
  };

  const handleDragEnd = (event: React.DragEvent<HTMLDivElement>) => {
    onDragEnd?.(event);
    if (!drag.current) return;
    clearDrop();
    drag.current.image?.remove();
    drag.current = undefined;
    setDragSource(undefined);
  };

  // What a drop would do, drawn on the rows: the branch it goes into and
  // what that branch holds, or the line where it goes between two rows.
  const dropInto =
    drop?.target.position === "into" ? drop.target.parentId : undefined;
  const inside = new Set<string>();
  if (dropInto !== undefined) {
    const at = indexOf.get(dropInto);
    const level = at === undefined ? 0 : (rows[at]?.level ?? 0);
    for (let i = (at ?? rows.length) + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.level <= level) break;
      inside.add(r.kind === "item" ? r.item.id : `loading:${r.parentId}`);
    }
  }
  const lineBefore =
    drop?.first ??
    (drop?.target.position === "before" ? drop.target.over : undefined);
  const lineAfter =
    drop?.target.position === "after" ? drop.target.over : undefined;

  // `pin` is the copy's top within the pins, for a row drawn pinned.
  const renderItem = (row: TreeRow<T>, pin?: number) => {
    const pinned = pin !== undefined;
    const { item } = row;
    const id = item.id;
    const isCurrent = id === current;
    const isRenaming = !pinned && id === renaming;
    const isSelected = shownSelection.has(id);
    const name = textValue?.(item);
    return (
      <ItemRow
        key={id}
        row={row}
        index={pinned ? undefined : indexOf.get(id)}
        virtual={virtual}
        toggle={() => toggle(row, pin)}
        rowRef={(el) => {
          if (el) rowIds.set(el, id);
        }}
        marks={{
          "data-focused": !pinned && hasFocus && id === focusId,
          "data-renaming": isRenaming,
          "data-icon-hover": id === iconHover,
          "data-cut": !pinned && cut?.includes(id) === true,
          "data-dragging": !pinned && dragSource?.includes(id) === true,
          "data-drop-target": id === dropInto,
          "data-drop-inside": !pinned && inside.has(id),
          "data-drop-before": !pinned && id === lineBefore,
          "data-drop-after": !pinned && id === lineAfter,
          // raymond's highlight leaves the current row for the drop target
          // while a drag has one, as a tree view's does.
          "data-yield": isCurrent && dropInto !== undefined && id !== dropInto,
        }}
        context={{
          row,
          pinned,
          current: isCurrent,
          currentToken,
          tabStop: !pinned && !isRenaming && id === tabStop,
          busy: row.expanded && !locked && item.children === undefined,
          draggable: !pinned && movable(item),
          menu: !pinned && menu !== undefined,
          selectable,
          selected: isSelected,
          register,
          activate: (event, place) => activate(row, event, place, pin),
        }}
        after={
          <>
            {selectable && (
              <SelectBox checked={isSelected} revealed={id === iconHover} />
            )}
            {isRenaming && (
              <RenameField
                initial={
                  renameValue?.(item) ?? name ?? labelText(elements.get(id))
                }
                selection={(value) =>
                  renameSelection?.(item, value) ?? [0, value.length]
                }
                validate={(value) => validateName?.(item, value)}
                labels={labels}
                onFinish={(value, focus) => finishRename(id, value, focus)}
              />
            )}
            {menu && (
              <RowMenu
                pinned={pinned}
                shown={!isRenaming}
                name={name}
                labels={labels}
                open={!pinned && menuFor === id}
                onOpenChange={(open) => setMenuFor(open ? id : undefined)}
                items={() => menu(item, actionsFor(item))}
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  const renameId = renameAfterMenu.current;
                  renameAfterMenu.current = undefined;
                  if (renameId !== undefined)
                    latest.current.startRename(renameId);
                  else elements.get(id)?.focus({ preventScroll: true });
                }}
              />
            )}
          </>
        }
      >
        {children(item, {
          level: row.level,
          branch: row.branch,
          expanded: row.expanded,
          current: isCurrent,
          match: row.match,
          pinned,
          selected: isSelected,
        })}
      </ItemRow>
    );
  };

  const renderRow = (row: TreeRow<T> | TreeLoadingRow, index: number) =>
    row.kind === "loading" ? (
      <LoadingRow
        key={`loading:${row.parentId}`}
        row={row}
        index={index}
        virtual={virtual}
        label={loadingLabel}
        dropInside={inside.has(`loading:${row.parentId}`)}
      />
    ) : (
      renderItem(row)
    );

  // The rows near the screen, and wherever they are, the rows the keyboard
  // and the current place need mounted. Until the rows are measured (on the
  // server, in the first frame) the first few stand in for the window.
  const { view, rowHeight } = viewport;
  let segments: TreeSegment[] | undefined;
  if (virtual) {
    const range =
      view && rowHeight
        ? windowRange(rows.length, rowHeight, view)
        : { start: 0, end: Math.min(rows.length, TREE_INITIAL_ROWS) };
    // The rows a rename, a drag and a menu stand on stay mounted too, so
    // none loses its field, its source or its focus to a scroll.
    const keep = [
      tabStop,
      current,
      focusId,
      pendingFocus.current,
      renaming,
      ...(dragSource ?? []),
      menuFor,
      follow.current?.id,
    ].flatMap((id) => (id === undefined ? [] : (indexOf.get(id) ?? [])));
    segments = mountedSegments(rows.length, range, keep);
  }
  const pins =
    stickyBranches && view && rowHeight
      ? pinnedRows(rows, rowHeight, view, maxPins(rowHeight, view.height))
      : [];
  const lastPin = pins.at(-1);
  pinsBottom.current = lastPin && rowHeight ? lastPin.top + rowHeight : 0;

  return (
    <div
      role="tree"
      data-slot="tree"
      data-virtual={virtual ? "" : undefined}
      data-selecting={shownSelection.size > 0 ? "" : undefined}
      aria-multiselectable={selectable || undefined}
      // The indent, the toggle's column and the row's height in variables
      // the rows, guides, lines and gaps all compute from. A coarse pointer
      // widens the toggle to a touch target and the step with it; raymond
      // takes the tree view's 19px step, keeping touch's sizes under a thumb.
      className={cn(
        "flex flex-col [--tree-inset:calc(var(--spacing)*2)] [--tree-line:calc(var(--tree-toggle)/2)] [--tree-row:var(--spacing-row)] [--tree-step:calc(var(--spacing)*4)] [--tree-toggle:calc(var(--spacing)*5)] touch:[--tree-row:calc(var(--spacing)*11)] touch:[--tree-step:calc(var(--spacing)*6)] touch:[--tree-toggle:calc(var(--spacing)*11)]",
        // An odd column puts its centre on a half pixel; the dotted lines
        // take the pixel left of it, which the 9px box centres on.
        "raymond:[--tree-inset:0.125rem] raymond:[--tree-line:calc(var(--tree-toggle)/2-0.5px)] raymond:[--tree-step:1.1875rem] raymond:[--tree-toggle:1.1875rem] raymond:touch:[--tree-line:calc(var(--tree-toggle)/2)] raymond:touch:[--tree-row:calc(var(--spacing)*11)] raymond:touch:[--tree-step:calc(var(--spacing)*6)] raymond:touch:[--tree-toggle:calc(var(--spacing)*11)]",
        className,
      )}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDownCapture={handlePointerDownCapture}
      onClickCapture={handleClickCapture}
      {...props}
      ref={setRoot}
    >
      {pins.length > 0 && (
        // Stuck to the scroller's top and taking no room, over the rows and
        // the raymond toggle boxes they lift.
        <div
          aria-hidden
          data-slot="tree-pins"
          className="sticky top-0 z-20 h-0"
        >
          {pins.map((pin, k) => {
            const row = rows[pin.index] as TreeRow<T>;
            return (
              <div
                key={row.item.id}
                data-slot="tree-pin"
                style={{ top: pin.top, zIndex: pins.length - k }}
                className={cn(
                  "absolute inset-x-0 h-(--tree-row) bg-[var(--tree-ground,var(--background))] raymond:bg-[var(--tree-ground,var(--window))]",
                  // The pins' lower edge, over the row so that its own fill
                  // cannot hide it, and taking no height.
                  k === pins.length - 1 &&
                    "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border raymond:after:bg-(--3d-shadow)",
                )}
              >
                {renderItem(row, pin.top)}
              </div>
            );
          })}
        </div>
      )}
      {segments
        ? // One flat list, so a gap appearing before a run of rows does not
          // remount them.
          segments.flatMap((segment, i) =>
            segment.kind === "gap" ? (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: a gap is only a height
                key={`gap:${i}`}
                aria-hidden
                data-slot="tree-gap"
                className="shrink-0"
                style={{ height: `calc(var(--tree-row) * ${segment.rows})` }}
              />
            ) : (
              rows
                .slice(segment.start, segment.end)
                .map((row, j) => renderRow(row, segment.start + j))
            ),
          )
        : rows.map(renderRow)}
    </div>
  );
}

const ROW =
  "group/tree-row relative flex min-h-(--tree-row) items-stretch pl-[calc(var(--tree-inset)+(var(--tree-level)-1)*var(--tree-step))] text-ui select-none";

/**
 * An ancestor's guide down the row: the default style draws one per level, a
 * hairline faint enough to stay chrome; raymond draws the tree view's dotted
 * connector, and only where the ancestor has a sibling still to come.
 */
function Guides({ continues }: { continues: readonly boolean[] }) {
  return continues.map((more, k) => (
    <span
      // biome-ignore lint/suspicious/noArrayIndexKey: one per level, never reordered
      key={k}
      aria-hidden
      data-slot="tree-guide"
      data-continues={more ? "" : undefined}
      style={{
        left: `calc(var(--tree-inset) + ${k} * var(--tree-step) + var(--tree-line))`,
      }}
      className="pointer-events-none absolute inset-y-0 border-l border-border/50 raymond:border-dotted raymond:border-(--3d-shadow) raymond:not-data-continues:hidden"
    />
  ));
}

/**
 * The toggle's column. Under raymond its own lines join the row to its
 * parent's: down from the row above, on to the next sibling unless this is
 * the last, and across to the item, the first root starting at its middle
 * since nothing is above it.
 */
const TOGGLE =
  "relative flex w-(--tree-toggle) shrink-0 items-center justify-center raymond:before:absolute raymond:before:inset-y-0 raymond:before:left-(--tree-line) raymond:before:border-l raymond:before:border-dotted raymond:before:border-(--3d-shadow) raymond:group-data-first/tree-row:before:top-[calc(50%-1px)] raymond:group-data-last/tree-row:before:bottom-[calc(50%+1px)] raymond:after:absolute raymond:after:top-[calc(50%-1px)] raymond:after:right-0 raymond:after:left-(--tree-line) raymond:after:border-t raymond:after:border-dotted raymond:after:border-(--3d-shadow)";

/**
 * What a drop would do, on the row: the branch it goes into (a primary wash
 * and frame) and what that branch holds (a fainter wash), or a line on the
 * row's upper or lower edge, from where its item starts. raymond fills only
 * the target's label, as a tree view's drop highlight, and draws the line
 * black with a short upright at each end.
 */
const DROP =
  "data-drop-inside:bg-primary/5 data-drop-target:bg-[color-mix(in_oklab,var(--primary)_12%,var(--background))] data-drop-target:inset-ring data-drop-target:inset-ring-primary raymond:data-drop-inside:bg-transparent raymond:data-drop-target:bg-transparent raymond:data-drop-target:inset-ring-0 before:pointer-events-none before:absolute before:-top-[3px] before:right-0 before:left-[calc(var(--tree-inset)+(var(--tree-level)-1)*var(--tree-step)+var(--tree-toggle))] before:z-10 before:h-1.5 before:bg-no-repeat before:bg-position-[left_center,center] before:bg-size-[6px_6px,100%_2px] raymond:before:bg-position-[left_center,right_center,center] raymond:before:bg-size-[2px_6px,2px_6px,100%_2px] data-drop-before:before:bg-[image:linear-gradient(var(--primary),var(--primary)),linear-gradient(var(--primary),var(--primary))] raymond:data-drop-before:before:bg-[image:linear-gradient(var(--foreground),var(--foreground)),linear-gradient(var(--foreground),var(--foreground)),linear-gradient(var(--foreground),var(--foreground))] after:pointer-events-none after:absolute after:-bottom-[3px] after:right-0 after:left-[calc(var(--tree-inset)+(var(--tree-level)-1)*var(--tree-step)+var(--tree-toggle))] after:z-10 after:h-1.5 after:bg-no-repeat after:bg-position-[left_center,center] after:bg-size-[6px_6px,100%_2px] raymond:after:bg-position-[left_center,right_center,center] raymond:after:bg-size-[2px_6px,2px_6px,100%_2px] data-drop-after:after:bg-[image:linear-gradient(var(--primary),var(--primary)),linear-gradient(var(--primary),var(--primary))] raymond:data-drop-after:after:bg-[image:linear-gradient(var(--foreground),var(--foreground)),linear-gradient(var(--foreground),var(--foreground)),linear-gradient(var(--foreground),var(--foreground))]";

/** A dragged row's image, off screen; raymond's is its label, highlighted and faint. */
const DRAG_IMAGE =
  "group/tree-row pointer-events-none fixed -top-[1000px] left-0 flex rounded-control bg-background text-ui text-foreground raymond:rounded-none raymond:bg-transparent raymond:opacity-70";

/** How many rows a drag of several carries, on the dragged row's image. */
const DRAG_COUNT =
  "mr-2 shrink-0 rounded-control bg-primary px-1.5 text-ui-xs font-semibold text-primary-foreground tabular-nums raymond:hidden";

type RowMarks = Record<`data-${string}`, boolean>;

function ItemRow({
  row,
  index,
  virtual,
  toggle,
  rowRef,
  marks,
  context,
  after,
  children,
}: {
  row: TreeRow<{ id: string; children?: readonly unknown[] }>;
  /** Its place among the visible rows; none for a pinned copy. */
  index: number | undefined;
  virtual: boolean;
  toggle: () => void;
  rowRef: (el: HTMLDivElement | null) => void;
  marks: RowMarks;
  context: RowContext;
  /** The rename field and the ⋯ button, beside the item rather than in it. */
  after: React.ReactNode;
  children: React.ReactNode;
}) {
  const kids = row.item.children;
  const opens = row.branch && (kids === undefined || kids.length > 0);
  return (
    <div
      ref={rowRef}
      role="none"
      {...Object.fromEntries(
        Object.entries(marks).map(([k, on]) => [k, on ? "" : undefined]),
      )}
      data-slot="tree-row"
      data-index={index}
      data-pinned={context.pinned ? "" : undefined}
      data-current={context.current ? "" : undefined}
      // "true", as the theme's data-selected variant reads it.
      data-selected={context.selected ? "true" : undefined}
      data-match={row.match ? "" : undefined}
      data-level={row.level}
      data-first={row.level === 1 && row.posinset === 1 ? "" : undefined}
      data-last={row.last ? "" : undefined}
      data-branch={row.branch ? "" : undefined}
      data-expanded={row.expanded ? "" : undefined}
      style={{ "--tree-level": row.level } as React.CSSProperties}
      className={cn(
        ROW,
        virtual && "h-(--tree-row)",
        // The rename field draws its own ring.
        "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground has-focus-visible:not-data-renaming:focus-ring-inset data-current:bg-accent data-current:font-medium data-current:text-accent-foreground data-current:state-cue",
        // Under raymond a tree view's rows: black on the well with no hover
        // and no fill, the highlight and focus rectangle on the label alone.
        "raymond:text-foreground raymond:transition-none raymond:hover:bg-transparent raymond:hover:text-foreground raymond:has-focus-visible:outline-none raymond:data-current:bg-transparent raymond:data-current:bg-none raymond:data-current:font-normal raymond:data-current:text-foreground",
        // A selected row takes a primary wash, deeper under the pointer,
        // that the current row's own look overrides; raymond's only ticks
        // its box, a tree view's highlight staying on the current row.
        "data-selected:not-data-current:bg-[color-mix(in_oklab,var(--primary)_14%,var(--background))] data-selected:not-data-current:text-foreground data-selected:not-data-current:hover:bg-[color-mix(in_oklab,var(--primary)_20%,var(--background))] raymond:data-selected:bg-transparent! raymond:data-selected:text-foreground",
        DROP,
      )}
    >
      <Guides continues={row.continues} />
      {/* Pointer only, and kept off the focus: the treeitem's aria-expanded
          says what the toggle shows, and → and ← work it. */}
      <span
        aria-hidden
        data-slot="tree-toggle"
        className={TOGGLE}
        onMouseDown={opens ? (event) => event.preventDefault() : undefined}
        onClick={
          opens
            ? (event) => {
                event.stopPropagation();
                toggle();
              }
            : undefined
        }
      >
        {opens && (
          <>
            <ChevronRightIcon className="size-3.5 text-muted-foreground transition-transform group-data-expanded/tree-row:rotate-90 motion-reduce:transition-none raymond:hidden" />
            {/* The tree view's 9px box, a minus in it, and a plus while
                closed; on a whole pixel so its strokes stay sharp. */}
            <span className="absolute top-[calc(50%-5px)] left-[calc(var(--tree-line)-4px)] z-10 hidden size-[9px] border border-(--3d-shadow) bg-(--window) before:absolute before:inset-x-px before:top-[3px] before:h-px before:bg-foreground after:absolute after:inset-y-px after:left-[3px] after:w-px after:bg-foreground raymond:block group-data-expanded/tree-row:after:hidden" />
          </>
        )}
      </span>
      <TreeRowContext.Provider value={context}>
        {children}
      </TreeRowContext.Provider>
      {after}
    </div>
  );
}

function LoadingRow({
  row,
  index,
  virtual,
  label,
  dropInside,
}: {
  row: TreeLoadingRow;
  index: number;
  virtual: boolean;
  label: string;
  dropInside: boolean;
}) {
  return (
    <div
      role="none"
      data-slot="tree-row"
      data-index={index}
      data-loading=""
      data-level={row.level}
      data-last=""
      data-drop-inside={dropInside ? "" : undefined}
      style={{ "--tree-level": row.level } as React.CSSProperties}
      className={cn(ROW, virtual && "h-(--tree-row)", DROP)}
    >
      <Guides continues={row.continues} />
      <span aria-hidden className={TOGGLE} />
      {/* raymond writes the words where the default style draws a bar. */}
      <span
        role="treeitem"
        tabIndex={-1}
        aria-disabled="true"
        aria-level={row.level}
        className="flex min-w-0 flex-1 items-center pr-3"
      >
        <Skeleton className="h-2.5 w-1/2 raymond:hidden" />
        <span className="sr-only raymond:not-sr-only raymond:text-muted-foreground">
          {label}
        </span>
      </span>
    </div>
  );
}

/**
 * The rename field, over the row's label from its start to whatever follows the name (a count,
 * a status), or the item's end. A sibling of the item, not inside it: an `a` holds no field, and
 * an `asChild` link is the app's to keep whole.
 */
function RenameField({
  initial,
  selection,
  validate,
  labels,
  onFinish,
}: {
  initial: string;
  selection: (value: string) => readonly [number, number];
  validate: (name: string) => string | undefined;
  labels: TreeLabels;
  /** The name to commit, or undefined to put the old one back; `focus` returns it to the row. */
  onFinish: (name: string | undefined, focus: boolean) => void;
}) {
  const [value, setValue] = React.useState(initial);
  const [place, setPlace] = React.useState<{ left: number; right: number }>();
  const box = React.useRef<HTMLSpanElement>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const done = React.useRef(false);
  const messageId = React.useId();

  const name = value.trim();
  // An empty or unchanged name is no error: it puts the old one back.
  const unchanged = name === "" || name === initial;
  const message = unchanged ? undefined : validate(name);

  const finish = (how: "enter" | "blur" | "escape") => {
    if (done.current || (how === "enter" && message !== undefined)) return;
    done.current = true;
    const keep = how !== "escape" && !unchanged && message === undefined;
    onFinish(keep ? name : undefined, how !== "blur");
  };
  const latest = React.useRef(finish);
  latest.current = finish;

  React.useLayoutEffect(() => {
    const row = box.current?.parentElement;
    const item = row?.querySelector("[data-slot=tree-item]");
    if (!row || !item) return;
    const measure = () => {
      const label = item.querySelector("[data-slot=tree-label]");
      const start = label?.querySelector("[data-rename-from]") ?? label;
      const rowRect = row.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const left = start
        ? start.getBoundingClientRect().left
        : (item.firstElementChild?.getBoundingClientRect().right ??
          itemRect.left);
      let right =
        itemRect.right -
        (Number.parseFloat(getComputedStyle(item).paddingRight) || 0);
      // The first thing drawn after the name; a screen reader's text
      // (sr-only, absolute) takes no room.
      for (let el = label?.nextElementSibling; el; el = el.nextElementSibling) {
        if (getComputedStyle(el).position === "absolute") continue;
        right = el.getBoundingClientRect().left - RENAME_GAP;
        break;
      }
      setPlace({
        // Over a whole label its text starts where the name's did; from a
        // part of one it keeps clear of the part before.
        left: left - rowRect.left - (start === label ? RENAME_INSET : 0),
        right: rowRect.right - right,
      });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(item);
    return () => observer.disconnect();
  }, []);

  // Mounted to be typed in, with the part of the name a reader most often
  // changes selected.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, as it opens
  React.useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const [start, end] = selection(initial);
    el.setSelectionRange(start, end);
  }, []);

  // Escape is the field's alone: heard before a dialog or sheet around the
  // tree, which listens on the document, can close.
  React.useEffect(() => {
    const el = input.current;
    const win = el?.ownerDocument.defaultView;
    if (!el || !win) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.target !== el) return;
      event.stopPropagation();
      event.preventDefault();
      latest.current("escape");
    };
    win.addEventListener("keydown", onKey, true);
    return () => win.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <span
      ref={box}
      className="absolute inset-y-0 z-10 flex items-center"
      style={place}
    >
      <Popover open={message !== undefined}>
        <PopoverAnchor asChild>
          <Input
            ref={input}
            data-slot="tree-rename"
            aria-label={labels.renameItem(initial)}
            aria-invalid={message !== undefined || undefined}
            aria-describedby={message === undefined ? undefined : messageId}
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing)
                return;
              event.preventDefault();
              finish("enter");
            }}
            // Leaving for another window is not leaving the field: it is
            // still open on the way back.
            onBlur={(event) => {
              if (event.currentTarget.ownerDocument.hasFocus()) finish("blur");
            }}
            // A field of the row's size, its ring drawn on its edge so it
            // stays inside the row; raymond's is a tree view's label edit,
            // a black frame on the window colour with no bevel.
            className="h-control-xs bg-background px-1 text-ui select-text [--focus-offset:0px] aria-invalid:ring-0 md:text-ui dark:bg-background raymond:rounded-none raymond:border-foreground raymond:bg-(--window) raymond:px-0.5 raymond:shadow-none raymond:focus-visible:outline-none"
          />
        </PopoverAnchor>
        <PopoverContent
          side="bottom"
          align="start"
          role="status"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          // The default style's message is a quiet card ruled in the
          // destructive colour; raymond's is the balloon Explorer shows
          // over a bad file name, headed in bold.
          className="w-auto max-w-72 border-destructive bg-background px-2 py-1.5 text-ui-sm text-destructive raymond:rounded-none raymond:border raymond:border-foreground raymond:bg-(--info) raymond:text-foreground raymond:shadow-none"
        >
          <p className="hidden font-bold raymond:block">
            {labels.renameFailed(initial)}
          </p>
          <p id={messageId} data-slot="tree-rename-message">
            {message}
          </p>
        </PopoverContent>
      </Popover>
    </span>
  );
}

/**
 * A selectable row's checkbox, drawn over its icon: on a selected row, on the row whose icon the
 * pointer is on, and on every row on touch once a selection is under way. Only drawn: a press
 * falls through to the item under it, which stays the link it is, and the treeitem's
 * `aria-selected` tells a screen reader. Measured, so it is not in a page rendered on the server.
 * The icon stays the item's, which hides it where the box is drawn.
 */
function SelectBox({
  checked,
  revealed,
}: {
  checked: boolean;
  revealed: boolean;
}) {
  const box = React.useRef<HTMLSpanElement>(null);
  const [place, setPlace] = React.useState<{ left: number; width: number }>();

  React.useLayoutEffect(() => {
    const row = box.current?.parentElement;
    const item = row?.querySelector("[data-slot=tree-item]");
    if (!row || !item) return;
    const measure = () => {
      const icon = iconPlace(row);
      if (!icon) return;
      const left = icon.left - row.getBoundingClientRect().left;
      const width = icon.right - icon.left;
      setPlace((prev) =>
        prev?.left === left && prev.width === width ? prev : { left, width },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(item);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      ref={box}
      aria-hidden
      data-slot="tree-select"
      data-placed={place ? "" : undefined}
      className="pointer-events-none absolute inset-y-0 flex items-center justify-center"
      style={place}
    >
      {place && (
        <SelectSlot checked={checked} revealed={revealed} tabIndex={-1} />
      )}
    </span>
  );
}

/** The field's edge against the name's, so its text starts where the name's did. */
const RENAME_INSET = 5;
/** The room kept between the field and what follows the name. */
const RENAME_GAP = 4;

/**
 * The ⋯ button at a row's end and the one menu it opens. Its column stays when it is not drawn,
 * so what the row shows at its end keeps still, and a pinned copy keeps it empty.
 */
function RowMenu({
  pinned,
  shown,
  name,
  labels,
  open,
  onOpenChange,
  items,
  onCloseAutoFocus,
}: {
  pinned: boolean;
  shown: boolean;
  /** The row's `textValue`; read from its label when the app gives none. */
  name: string | undefined;
  labels: TreeLabels;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: () => React.ReactNode;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const button = React.useRef<HTMLButtonElement>(null);
  const [read, setRead] = React.useState("");
  React.useLayoutEffect(() => {
    if (name !== undefined) return;
    const text = labelText(
      button.current
        ?.closest("[data-slot=tree-row]")
        ?.querySelector("[data-slot=tree-item]"),
    );
    if (text !== read) setRead(text);
  });
  // The items are asked for only while the menu is open, and kept through
  // its closing.
  const content = React.useRef<React.ReactNode>(null);
  if (open) content.current = items();

  if (pinned) {
    return (
      <span aria-hidden className={MENU_CELL}>
        <span className="block size-control-xs" />
      </span>
    );
  }
  return (
    <span className={MENU_CELL}>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={button}
            variant="ghost"
            size="icon-xs"
            tabIndex={-1}
            aria-label={labels.rowActions(name ?? read)}
            data-slot="tree-row-menu"
            // As the toggle: a press leaves the focus on the row.
            onMouseDown={(event) => event.preventDefault()}
            // Drawn on the current row, the row under the pointer, the
            // focused row and on every row for touch; the rest keep the
            // column empty.
            className={cn(
              "invisible",
              shown &&
                "group-hover/tree-row:visible group-data-current/tree-row:visible group-data-focused/tree-row:visible group-has-focus-visible/tree-row:visible aria-expanded:visible touch:visible",
            )}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={onCloseAutoFocus}>
          {content.current}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

const MENU_CELL = "flex shrink-0 items-center pr-1";

/**
 * A selectable row's item: a label that leads keeps an icon's room before it for the checkbox,
 * and the icon gives way wherever the checkbox, once placed, is drawn.
 */
const SELECTABLE_ITEM =
  "has-[>[data-slot=tree-label]:first-child]:pl-[calc(1rem+var(--spacing)*2)] group-has-[>[data-placed]]/tree-row:group-data-selected/tree-row:[&>:first-child:not([data-slot=tree-label])]:invisible group-has-[>[data-placed]]/tree-row:group-data-icon-hover/tree-row:[&>:first-child:not([data-slot=tree-label])]:invisible touch:in-data-selecting:group-has-[>[data-placed]]/tree-row:[&>:first-child:not([data-slot=tree-label])]:invisible";

/**
 * A row's place, rendered by a `Tree`'s `children`: an `a` given `href`, a router's link or a
 * `button` (a place held in app state) through `asChild`, or with neither a grouping node, which
 * opens and closes. Lead with an icon, then a `TreeLabel`, and end with a `TreeCount` as needed.
 * In a `selectable` tree the checkbox takes the icon's place; a row with no icon keeps that
 * room before its label. The tree sets its role, focus and `aria-*`, and leaves them off a pinned
 * copy, which only a pointer reaches.
 */
function TreeItem({
  asChild = false,
  className,
  onClick,
  ref,
  ...props
}: React.ComponentProps<"a"> & { asChild?: boolean }) {
  const context = React.useContext(TreeRowContext);
  if (!context) throw new Error("TreeItem renders inside a Tree's row");
  const { row, register, pinned } = context;
  const id = idOf(row);
  const place = asChild || props.href !== undefined;
  // Typed as the anchor its props are: a grouping node's div takes none an
  // anchor lacks.
  const Comp = (asChild ? Slot.Root : place ? "a" : "div") as "a";
  const setRef = React.useCallback(
    (el: HTMLElement | null) => {
      // The real row's element is the one the keyboard moves to.
      if (!pinned) register(id, el);
      const anchor = el as HTMLAnchorElement | null;
      if (typeof ref === "function") ref(anchor);
      else if (ref) ref.current = anchor;
    },
    [register, pinned, id, ref],
  );
  return (
    <Comp
      {...props}
      ref={setRef}
      {...(pinned
        ? {
            tabIndex: -1,
            // A press would focus the copy, which the keyboard cannot use.
            onMouseDown: (event: React.MouseEvent<HTMLAnchorElement>) => {
              props.onMouseDown?.(event);
              event.preventDefault();
            },
          }
        : {
            role: "treeitem",
            tabIndex: context.tabStop ? 0 : -1,
            "aria-level": row.level,
            "aria-posinset": row.posinset,
            "aria-setsize": row.setsize,
            "aria-expanded": row.branch ? row.expanded : undefined,
            "aria-current": context.current ? context.currentToken : undefined,
            "aria-selected": context.selectable ? context.selected : undefined,
            "aria-busy": context.busy || undefined,
            "aria-haspopup": context.menu ? "menu" : undefined,
            draggable: context.draggable && !place ? true : undefined,
          })}
      data-slot="tree-item"
      onClick={(event) => {
        onClick?.(event);
        context.activate(event, place);
      }}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 self-stretch pr-3 text-left text-inherit outline-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // A row cut or being dragged fades, as Explorer fades a cut file.
        "group-data-cut/tree-row:[&_svg]:opacity-50 group-data-dragging/tree-row:[&_svg]:opacity-50",
        // A row drawn without a TreeLabel takes raymond's highlight and focus
        // rectangle across its item instead.
        "raymond:not-has-data-[slot=tree-label]:group-data-current/tree-row:bg-primary raymond:not-has-data-[slot=tree-label]:group-data-current/tree-row:text-primary-foreground raymond:not-has-data-[slot=tree-label]:group-has-focus-visible/tree-row:focus-ring-inset raymond:not-has-data-[slot=tree-label]:group-data-current/tree-row:[--ring:var(--primary-foreground)]",
        context.selectable && SELECTABLE_ITEM,
        className,
      )}
    />
  );
}

/**
 * The row's text, truncated to fit. raymond draws the current place's highlight and the focus
 * rectangle on it alone, as a tree view does. A rename field covers it, starting at a
 * descendant marked `data-rename-from` when there is one.
 */
function TreeLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tree-label"
      className={cn(
        "truncate raymond:px-0.5 raymond:[--focus-offset:-1px] raymond:[--ring:var(--foreground)] raymond:group-has-focus-visible/tree-row:focus-ring raymond:group-data-current/tree-row:bg-primary raymond:group-data-current/tree-row:text-primary-foreground raymond:group-data-current/tree-row:[--ring:var(--primary-foreground)]",
        // Hidden under the rename field so it cannot show through; faded
        // while cut or dragged, which raymond leaves to the icon. raymond's
        // drop target is its label, highlighted.
        "group-data-renaming/tree-row:invisible group-data-cut/tree-row:opacity-50 group-data-dragging/tree-row:opacity-50 raymond:group-data-cut/tree-row:opacity-100 raymond:group-data-dragging/tree-row:opacity-100 raymond:group-data-drop-target/tree-row:bg-primary raymond:group-data-drop-target/tree-row:text-primary-foreground",
        // raymond's highlight gives way to a drop target elsewhere; and where
        // a checkbox stands in for the icon, the label is what fades.
        "raymond:group-data-yield/tree-row:bg-transparent! raymond:group-data-yield/tree-row:text-foreground! raymond:group-data-yield/tree-row:[--ring:var(--foreground)]! raymond:group-data-selected/tree-row:group-data-cut/tree-row:opacity-50! raymond:group-data-selected/tree-row:group-data-dragging/tree-row:opacity-50! raymond:touch:in-data-selecting:group-data-cut/tree-row:opacity-50! raymond:touch:in-data-selecting:group-data-dragging/tree-row:opacity-50!",
        className,
      )}
      {...props}
    />
  );
}

/** A count, size or offset at the row's end. */
function TreeCount({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tree-count"
      className={cn(
        "ml-auto text-ui-sm font-normal tabular-nums text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Tree, TreeCount, TreeItem, TreeLabel };
