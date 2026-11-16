import { ChevronRightIcon } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";

import { isPlainPress } from "../lib/link.ts";
import {
  ancestorsOf,
  matchAncestors,
  type TreeFilterMode,
  type TreeLoadingRow,
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
}

type TreeAlign = "nearest" | "start" | "center";

/** Scrolling a tree on the app's word. */
export interface TreeHandle {
  /**
   * Opens the way to `id` and scrolls its row into sight below the pins. Moves neither the
   * focus nor `current`; does nothing for an id the tree does not hold.
   */
  scrollToItem(id: string, align?: TreeAlign): void;
}

interface RowContext {
  row: TreeRow<unknown>;
  pinned: boolean;
  current: boolean;
  currentToken: "page" | "location";
  tabStop: boolean;
  busy: boolean;
  register: (id: string, el: HTMLElement | null) => void;
  activate: (event: React.MouseEvent<HTMLElement>, place: boolean) => void;
}

const TreeRowContext = React.createContext<RowContext | null>(null);

/** How long typed characters add up to one search, as the APG's tree view waits. */
const TYPEAHEAD_MS = 500;

const idOf = (row: TreeRow<unknown>) => (row.item as TreeNode<unknown>).id;

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
  className,
  onKeyDown,
  onFocus,
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

  const visible = (id: string | undefined) =>
    id !== undefined && itemRows.some((r) => r.item.id === id);
  const tabStop = visible(focusId)
    ? focusId
    : visible(current)
      ? current
      : (itemRows.find((r) => r.match) ?? itemRows[0])?.item.id;

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

  const latest = React.useRef({ items, expanded, commit, indexOf, reveal });
  latest.current = { items, expanded, commit, indexOf, reveal };

  React.useImperativeHandle(
    handle,
    () => ({
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
    for (const [id, el] of elements) {
      if (el === event.target) {
        if (id !== focusId) setFocusId(id);
        return;
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const index = itemRows.findIndex(
      (r) => elements.get(r.item.id) === event.target,
    );
    const row = itemRows[index];
    if (!row) return;
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

  // `pin` is the copy's top within the pins, for a row drawn pinned.
  const renderItem = (row: TreeRow<T>, pin?: number) => {
    const pinned = pin !== undefined;
    const isCurrent = row.item.id === current;
    return (
      <ItemRow
        key={row.item.id}
        row={row}
        index={pinned ? undefined : indexOf.get(row.item.id)}
        virtual={virtual}
        toggle={() => toggle(row, pin)}
        context={{
          row,
          pinned,
          current: isCurrent,
          currentToken,
          tabStop: !pinned && row.item.id === tabStop,
          busy: row.expanded && !locked && row.item.children === undefined,
          register,
          activate: (event, place) => activate(row, event, place, pin),
        }}
      >
        {children(row.item, {
          level: row.level,
          branch: row.branch,
          expanded: row.expanded,
          current: isCurrent,
          match: row.match,
          pinned,
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
    const keep = [tabStop, current, focusId, pendingFocus.current].flatMap(
      (id) => (id === undefined ? [] : (indexOf.get(id) ?? [])),
    );
    segments = mountedSegments(rows.length, range, keep);
  }
  const pins =
    stickyBranches && view && rowHeight
      ? pinnedRows(rows, rowHeight, view, maxPins(rowHeight, view.height))
      : [];

  return (
    <div
      role="tree"
      data-slot="tree"
      data-virtual={virtual ? "" : undefined}
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
      onKeyDown={handleKeyDown}
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

function ItemRow({
  row,
  index,
  virtual,
  toggle,
  context,
  children,
}: {
  row: TreeRow<{ id: string; children?: readonly unknown[] }>;
  /** Its place among the visible rows; none for a pinned copy. */
  index: number | undefined;
  virtual: boolean;
  toggle: () => void;
  context: RowContext;
  children: React.ReactNode;
}) {
  const kids = row.item.children;
  const opens = row.branch && (kids === undefined || kids.length > 0);
  return (
    <div
      role="none"
      data-slot="tree-row"
      data-index={index}
      data-pinned={context.pinned ? "" : undefined}
      data-current={context.current ? "" : undefined}
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
        "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground has-focus-visible:focus-ring-inset data-current:bg-accent data-current:font-medium data-current:text-accent-foreground data-current:state-cue",
        // Under raymond a tree view's rows: black on the well with no hover
        // and no fill, the highlight and focus rectangle on the label alone.
        "raymond:text-foreground raymond:transition-none raymond:hover:bg-transparent raymond:hover:text-foreground raymond:has-focus-visible:outline-none raymond:data-current:bg-transparent raymond:data-current:bg-none raymond:data-current:font-normal raymond:data-current:text-foreground",
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
    </div>
  );
}

function LoadingRow({
  row,
  index,
  virtual,
  label,
}: {
  row: TreeLoadingRow;
  index: number;
  virtual: boolean;
  label: string;
}) {
  return (
    <div
      role="none"
      data-slot="tree-row"
      data-index={index}
      data-loading=""
      data-level={row.level}
      data-last=""
      style={{ "--tree-level": row.level } as React.CSSProperties}
      className={cn(ROW, virtual && "h-(--tree-row)")}
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
 * A row's place, rendered by a `Tree`'s `children`: an `a` given `href`, a router's link or a
 * `button` (a place held in app state) through `asChild`, or with neither a grouping node, which
 * opens and closes. Lead with an icon, then a `TreeLabel`, and end with a `TreeCount` as needed.
 * The tree sets its role, focus and `aria-*`, and leaves them off a pinned copy, which only a
 * pointer reaches.
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
            "aria-busy": context.busy || undefined,
          })}
      data-slot="tree-item"
      onClick={(event) => {
        onClick?.(event);
        context.activate(event, place);
      }}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 self-stretch pr-3 text-left text-inherit outline-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // A row drawn without a TreeLabel takes raymond's highlight and focus
        // rectangle across its item instead.
        "raymond:not-has-data-[slot=tree-label]:group-data-current/tree-row:bg-primary raymond:not-has-data-[slot=tree-label]:group-data-current/tree-row:text-primary-foreground raymond:not-has-data-[slot=tree-label]:group-has-focus-visible/tree-row:focus-ring-inset raymond:not-has-data-[slot=tree-label]:group-data-current/tree-row:[--ring:var(--primary-foreground)]",
        className,
      )}
    />
  );
}

/**
 * The row's text, truncated to fit. raymond draws the current place's highlight and the focus
 * rectangle on it alone, as a tree view does.
 */
function TreeLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tree-label"
      className={cn(
        "truncate raymond:px-0.5 raymond:[--focus-offset:-1px] raymond:[--ring:var(--foreground)] raymond:group-has-focus-visible/tree-row:focus-ring raymond:group-data-current/tree-row:bg-primary raymond:group-data-current/tree-row:text-primary-foreground raymond:group-data-current/tree-row:[--ring:var(--primary-foreground)]",
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
