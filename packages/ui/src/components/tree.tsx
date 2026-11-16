import { ChevronRightIcon } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";

import {
  ancestorsOf,
  type TreeLoadingRow,
  type TreeNode,
  type TreeRow,
  visibleRows,
} from "../lib/tree-rows.ts";
import { cn } from "../lib/utils.ts";
import { Skeleton } from "./skeleton.tsx";

/** What a row's render function knows about the row it draws. */
export interface TreeRowState {
  level: number;
  branch: boolean;
  expanded: boolean;
  current: boolean;
}

interface RowContext {
  row: TreeRow<unknown>;
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
 * come. `filter` shows the nodes it matches and their ancestors, opened, and nothing else.
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
  loadingLabel = "Loading…",
  className,
  onKeyDown,
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
  loadingLabel?: string;
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
  const rows = React.useMemo(
    () => visibleRows(items, expanded, filter),
    [items, expanded, filter],
  );
  const itemRows = React.useMemo(
    () => rows.filter((r): r is TreeRow<T> => r.kind === "item"),
    [rows],
  );

  const [focusId, setFocusId] = React.useState<string>();
  const elements = React.useRef(new Map<string, HTMLElement>()).current;
  // Focus waits for the commit that renders the row it moves to.
  const pendingFocus = React.useRef<string>(undefined);
  const typed = React.useRef({ text: "", at: 0 });

  const visible = (id: string | undefined) =>
    id !== undefined && itemRows.some((r) => r.item.id === id);
  const tabStop = visible(focusId)
    ? focusId
    : visible(current)
      ? current
      : itemRows[0]?.item.id;

  const commit = (next: Set<string>) => {
    if (!controlled) setInner(next);
    onExpandedChange?.([...next]);
  };

  const focusInTree = () =>
    [...elements.values()].some((el) => el === el.ownerDocument.activeElement);

  const moveFocus = (id: string) => {
    setFocusId(id);
    pendingFocus.current = id;
  };

  const setOpen = (id: string, open: boolean) => {
    if (expanded.has(id) === open) return;
    const next = new Set(expanded);
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
    commit(next);
  };

  React.useLayoutEffect(() => {
    const id = pendingFocus.current;
    if (id === undefined) return;
    pendingFocus.current = undefined;
    elements.get(id)?.focus();
  });

  // Opens the way to the current place each time it changes, and only then:
  // a branch the reader closes afterwards stays closed.
  const latest = React.useRef({ items, expanded, commit });
  latest.current = { items, expanded, commit };
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

  const activate = (
    row: TreeRow<T>,
    event: React.MouseEvent<HTMLElement>,
    place: boolean,
  ) => {
    setFocusId(row.item.id);
    if (filter || !row.branch) return;
    if (!place) {
      setOpen(row.item.id, !row.expanded);
      return;
    }
    // Not isPlainClick: a link that opens in place, or a router's link, has
    // already called preventDefault by now, and a plain click on it still
    // opens the branch.
    const target = event.currentTarget.getAttribute("target");
    if (
      event.button === 0 &&
      !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) &&
      (target === null || target === "" || target === "_self")
    ) {
      setOpen(row.item.id, true);
    }
  };

  const toggle = (row: TreeRow<T>) => {
    if (filter) return;
    setOpen(row.item.id, !row.expanded);
    if (focusInTree()) moveFocus(row.item.id);
    else setFocusId(row.item.id);
  };

  const rowText = (id: string) => {
    const el = elements.get(id);
    const label = el?.querySelector("[data-slot=tree-label]") ?? el;
    return (label?.textContent ?? "").trim().toLowerCase();
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
    const opens = row.branch && !filter;

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
        if (filter) break;
        const next = new Set(expanded);
        for (const r of itemRows) {
          if (r.parentId === row.parentId && r.branch) next.add(r.item.id);
        }
        if (next.size !== expanded.size) commit(next);
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
          if (r && rowText(r.item.id).startsWith(buffer.text)) {
            go(r);
            break;
          }
        }
      }
    }
    event.preventDefault();
  };

  return (
    <div
      role="tree"
      data-slot="tree"
      // The indent, and the toggle's column, in variables the rows, guides
      // and lines all compute from. A coarse pointer widens the toggle to a
      // touch target and the step with it; raymond takes the tree view's
      // 19px step, keeping touch's sizes under a thumb.
      className={cn(
        "flex flex-col [--tree-inset:calc(var(--spacing)*2)] [--tree-line:calc(var(--tree-toggle)/2)] [--tree-step:calc(var(--spacing)*4)] [--tree-toggle:calc(var(--spacing)*5)] touch:[--tree-step:calc(var(--spacing)*6)] touch:[--tree-toggle:calc(var(--spacing)*11)]",
        // An odd column puts its centre on a half pixel; the dotted lines
        // take the pixel left of it, which the 9px box centres on.
        "raymond:[--tree-inset:0.125rem] raymond:[--tree-line:calc(var(--tree-toggle)/2-0.5px)] raymond:[--tree-step:1.1875rem] raymond:[--tree-toggle:1.1875rem] raymond:touch:[--tree-line:calc(var(--tree-toggle)/2)] raymond:touch:[--tree-step:calc(var(--spacing)*6)] raymond:touch:[--tree-toggle:calc(var(--spacing)*11)]",
        className,
      )}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {rows.map((row) =>
        row.kind === "loading" ? (
          <LoadingRow
            key={`loading:${row.parentId}`}
            row={row}
            label={loadingLabel}
          />
        ) : (
          <ItemRow
            key={row.item.id}
            row={row}
            toggle={() => toggle(row)}
            context={{
              row,
              current: row.item.id === current,
              currentToken,
              tabStop: row.item.id === tabStop,
              busy: row.expanded && !filter && row.item.children === undefined,
              register,
              activate: (event, place) => activate(row, event, place),
            }}
          >
            {children(row.item, {
              level: row.level,
              branch: row.branch,
              expanded: row.expanded,
              current: row.item.id === current,
            })}
          </ItemRow>
        ),
      )}
    </div>
  );
}

const ROW =
  "group/tree-row relative flex min-h-row items-stretch pl-[calc(var(--tree-inset)+(var(--tree-level)-1)*var(--tree-step))] text-ui select-none touch:min-h-11";

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
  toggle,
  context,
  children,
}: {
  row: TreeRow<{ id: string; children?: readonly unknown[] }>;
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
      data-current={context.current ? "" : undefined}
      data-level={row.level}
      data-first={row.level === 1 && row.posinset === 1 ? "" : undefined}
      data-last={row.last ? "" : undefined}
      data-branch={row.branch ? "" : undefined}
      data-expanded={row.expanded ? "" : undefined}
      style={{ "--tree-level": row.level } as React.CSSProperties}
      className={cn(
        ROW,
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

function LoadingRow({ row, label }: { row: TreeLoadingRow; label: string }) {
  return (
    <div
      role="none"
      data-slot="tree-row"
      data-loading=""
      data-level={row.level}
      data-last=""
      style={{ "--tree-level": row.level } as React.CSSProperties}
      className={ROW}
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
 * The tree sets its role, focus and `aria-*`.
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
  const { row, register } = context;
  const id = idOf(row);
  const place = asChild || props.href !== undefined;
  // Typed as the anchor its props are: a grouping node's div takes none an
  // anchor lacks.
  const Comp = (asChild ? Slot.Root : place ? "a" : "div") as "a";
  const setRef = React.useCallback(
    (el: HTMLElement | null) => {
      register(id, el);
      const anchor = el as HTMLAnchorElement | null;
      if (typeof ref === "function") ref(anchor);
      else if (ref) ref.current = anchor;
    },
    [register, id, ref],
  );
  return (
    <Comp
      {...props}
      ref={setRef}
      role="treeitem"
      tabIndex={context.tabStop ? 0 : -1}
      aria-level={row.level}
      aria-posinset={row.posinset}
      aria-setsize={row.setsize}
      aria-expanded={row.branch ? row.expanded : undefined}
      aria-current={context.current ? context.currentToken : undefined}
      aria-busy={context.busy || undefined}
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
