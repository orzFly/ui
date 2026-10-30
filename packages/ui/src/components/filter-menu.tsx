import { CheckIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import type {
  ComponentProps,
  KeyboardEvent,
  PointerEvent,
  ReactElement,
  ReactNode,
  Ref,
} from "react";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../lib/utils.ts";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "./popover.tsx";

export interface FilterMenuRow {
  /** Unique across every section. */
  id: string;
  disabled?: boolean;
}

export interface FilterMenuSection<R extends FilterMenuRow> {
  id: string;
  label?: ReactNode;
  rows: readonly R[];
}

export interface FilterMenuRowState {
  highlighted: boolean;
  selected: boolean;
  /** What the row's own list is filtered by: the menu's query, or its submenu's. */
  query: string;
}

export interface FilterMenuSubmenuFilter {
  placeholder?: string;
  /** Defaults to "Filter" and the submenu's label. */
  label?: string;
}

export interface FilterMenuHandle {
  /** The highlight back on `selectedId`, firing `onHighlight(null)`; for a control in `header` that commits at once. */
  resetHighlight(): void;
}

export interface FilterMenuProps<R extends FilterMenuRow> {
  ref?: Ref<FilterMenuHandle>;
  /** The trigger, rendered through `PopoverTrigger asChild`. */
  children: ReactElement;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  query: string;
  /** Called with `""` as the menu opens, so every opening starts unfiltered. */
  onQueryChange: (query: string) => void;
  /** Already filtered for `query`; sections without rows are skipped. */
  sections: readonly FilterMenuSection<R>[];
  renderRow: (row: R, state: FilterMenuRowState) => ReactNode;
  /** The committed row: checked, and where the highlight rests when nobody moved it. */
  selectedId?: string;
  /**
   * The row the user moved the highlight to, by key, pointer or typing.
   * `null` means "show the committed state": the highlight rests on
   * `selectedId` untouched, the pointer left the list, or the menu closed.
   */
  onHighlight?: (row: R | null) => void;
  /** The menu closes after it. */
  onSelect: (row: R) => void;
  /**
   * A row's submenu rows, filtered for `query`: what its filter box holds, or
   * `""` without one. Undefined or empty for `""` = no submenu. Ids unique
   * across the whole menu.
   */
  getSubmenu?: (row: R, query: string) => readonly R[] | undefined;
  /** Gives a row's submenu its own filter box; undefined = none. */
  submenuFilter?: (row: R) => FilterMenuSubmenuFilter | undefined;
  /** The committed row inside a submenu: checked there. */
  selectedSubmenuId?: string;
  /** Accessible name of a row's submenu listbox. */
  submenuLabel?: (row: R) => string;
  header?: ReactNode;
  footer?: ReactNode;
  placeholder?: string;
  inputLabel?: string;
  listLabel?: string;
  empty?: (query: string) => ReactNode;
  align?: ComponentProps<typeof PopoverContent>["align"];
  side?: ComponentProps<typeof PopoverContent>["side"];
  sideOffset?: number;
  className?: string;
}

/** Case-folded, with diacritics dropped, so `frappe` finds `Frappé`. */
function fold(text: string): string {
  // A final sigma lowers to ς only at a word's end, which a single character
  // folded on its own never is; σ for both keeps a text matching itself.
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ς/g, "σ");
}

/**
 * Where `query` occurs in `text`, folded as above, as a range of `text`'s own
 * indices; `null` when it does not. An empty query matches at 0 with nothing
 * to mark.
 */
export function matchText(
  text: string,
  query: string,
): { start: number; end: number } | null {
  const needle = fold(query);
  if (needle === "") return { start: 0, end: 0 };
  // Folding changes lengths (é is one unit, then two, then one), so each
  // folded unit remembers the source character it came from.
  let folded = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let at = 0;
  for (const char of text) {
    const part = fold(char);
    if (part === "" && ends.length > 0) {
      // A combining mark already in the source joins its base letter's range.
      ends[ends.length - 1] = at + char.length;
    }
    for (let i = 0; i < part.length; i++) {
      starts.push(at);
      ends.push(at + char.length);
    }
    folded += part;
    at += char.length;
  }
  const hit = folded.indexOf(needle);
  if (hit < 0) return null;
  return {
    start: starts[hit] as number,
    end: ends[hit + needle.length - 1] as number,
  };
}

/**
 * `text`, with the part `query` matched in a `<mark>`. One element, so a
 * flex row lays it out as one item rather than three.
 */
export function MatchedText({ text, query }: { text: string; query: string }) {
  const range = matchText(text, query);
  if (!range || range.start === range.end) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, range.start)}
      <mark className="bg-transparent font-semibold text-inherit underline decoration-primary/60 underline-offset-2">
        {text.slice(range.start, range.end)}
      </mark>
      {text.slice(range.end)}
    </span>
  );
}

const FOCUSABLE =
  'input, textarea, select, button, a[href], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** Focuses the first element after (or before) `from` in tab order that takes it. */
function focusBeside(
  from: HTMLElement,
  backwards: boolean,
  skip: Element | null,
) {
  const all = [...document.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) => el === from || (!skip?.contains(el) && el.tabIndex >= 0),
  );
  const index = all.indexOf(from);
  const candidates = backwards
    ? all.slice(0, Math.max(index, 0)).reverse()
    : all.slice(index + 1);
  for (const el of candidates) {
    el.focus({ preventScroll: false });
    if (document.activeElement === el) return;
  }
  // Nothing beyond the trigger takes focus; keep it somewhere useful.
  from.focus({ preventScroll: true });
}

type Point = { x: number; y: number };

/** Ray casting, the test Radix Menu's submenu grace area uses. */
function insidePolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i] as Point;
    const b = polygon[j] as Point;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** How long the pointer may take crossing other rows toward an open submenu. */
const GRACE_MS = 300;

const ROW_CLASS =
  "group/option relative flex w-full cursor-default items-center rounded-item text-sm min-h-row touch:min-h-11 select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const CELL_CLASS = "gap-1.5 py-1 pl-1.5";

const OPTION_CLASS = cn(
  ROW_CLASS,
  CELL_CLASS,
  "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
);

/**
 * A split row's left half, the part that picks the row. Only it lights up:
 * the chevron's half opens the submenu, which hovering the row already did.
 */
const ACTION_CLASS = cn(
  "relative flex min-w-0 flex-1 items-center self-stretch rounded-item pr-6.5",
  CELL_CLASS,
  "group-data-highlighted/option:bg-accent group-data-highlighted/option:text-accent-foreground",
);

function step<R extends FilterMenuRow>(
  from: readonly R[],
  at: number,
  by: 1 | -1,
): R | undefined {
  for (let i = at + by; i >= 0 && i < from.length; i += by) {
    const row = from[i] as R;
    if (!row.disabled) return row;
  }
  return undefined;
}

function FilterBox({
  expanded,
  ...props
}: ComponentProps<"input"> & { expanded: boolean }) {
  return (
    <div className="flex items-center gap-2 border-b px-2.5">
      <SearchIcon
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground"
      />
      <input
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-autocomplete="list"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="h-control-lg min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm touch:h-10 touch:text-base"
        {...props}
      />
    </div>
  );
}

function Mark({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute flex size-4 items-center justify-center",
        className,
      )}
    >
      {children}
    </span>
  );
}

const isEscapeOfComposition = (event: globalThis.KeyboardEvent) =>
  event.isComposing || event.keyCode === 229;

/**
 * A popover with a filter box over a list, the combobox pattern: focus stays
 * in the box, so typing always filters, and the arrow keys walk a highlight
 * that `aria-activedescendant` follows. The caller filters; this component
 * owns the surface, the highlight and the keys.
 */
export function FilterMenu<R extends FilterMenuRow>({
  ref,
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  query,
  onQueryChange,
  sections,
  renderRow,
  selectedId,
  onHighlight,
  onSelect,
  getSubmenu,
  submenuFilter,
  selectedSubmenuId,
  submenuLabel,
  header,
  footer,
  placeholder = "Filter…",
  inputLabel = "Filter",
  listLabel,
  empty = (q) => (q === "" ? "Nothing to pick" : `No matches for "${q}"`),
  align = "start",
  side,
  sideOffset,
  className,
}: FilterMenuProps<R>) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const [highlight, setHighlightId] = useState<string | null>(null);
  // Non-null while the highlight is inside the highlighted row's submenu.
  const [subHighlight, setSubHighlight] = useState<string | null>(null);
  // A submenu opens for a highlight the user moved, not for one resting on
  // the committed row or the query's first hit.
  const [moved, setMoved] = useState(false);
  // Kept by parent, so passing back over the parent row on the way into its
  // submenu does not wipe what was typed there.
  const [subQuery, setSubQuery] = useState<{
    parent: string;
    text: string;
    /**
     * The surface's height before the first keystroke. Shrinking under a
     * filter, a submenu that was shifted to fit the viewport would slide back
     * toward its row and out from under the pointer, which closes it.
     */
    height: number;
  } | null>(null);
  // The submenu's filter box has focus, and with it the keys.
  const [subKeys, setSubKeys] = useState(false);
  // Like `mode`: typing in the submenu's box puts its highlight on the first
  // hit until the user moves it.
  const subMode = useRef<"hit" | "user">("user");
  const reported = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const subInput = useRef<HTMLInputElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const submenu = useRef<HTMLDivElement>(null);
  const anchor = useRef<{
    contextElement: Element;
    getBoundingClientRect: () => DOMRect;
  } | null>(null);
  const tabbing = useRef<"forward" | "backward" | null>(null);
  const grace = useRef<{
    polygon: Point[];
    until: number;
    right: boolean;
    x: number;
    towards: boolean;
  } | null>(null);
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerIn = useRef<"list" | "submenu" | null>(null);
  // A row's leave fires at the same point as the move that crossed out of it,
  // so the direction it left in is only known from the sample before.
  const lastX = useRef<number | null>(null);
  /**
   * Who placed the highlight: resting on the committed row, on the query's
   * first hit, or by the user. The first two follow the list as it changes.
   */
  const mode = useRef<"rest" | "hit" | "user">("rest");
  const base = useId();
  const listId = `${base}-list`;
  const submenuId = `${base}-submenu`;

  const visible = useMemo(
    () => sections.filter((section) => section.rows.length > 0),
    [sections],
  );
  const rows = useMemo(() => visible.flatMap((s) => s.rows), [visible]);
  const indexOf = useMemo(
    () => new Map(rows.map((row, i) => [row.id, i])),
    [rows],
  );
  const optionId = (index: number) => `${base}-option-${index}`;
  const subOptionId = (index: number) => `${base}-suboption-${index}`;

  const onHighlightRef = useRef(onHighlight);
  onHighlightRef.current = onHighlight;
  const report = useCallback((row: R | null) => {
    const id = row?.id ?? null;
    if (reported.current === id) return;
    reported.current = id;
    onHighlightRef.current?.(row);
  }, []);

  // Moving the highlight in the list always leaves the submenu.
  const setHighlightState = useCallback((id: string | null, byUser = false) => {
    setHighlightId(id);
    setSubHighlight(null);
    setSubKeys(false);
    subMode.current = "user";
    setMoved(byUser);
  }, []);

  /** A highlight the user moved, reported as such. */
  const move = (row: R | null) => {
    mode.current = "user";
    setHighlightState(row?.id ?? null, true);
    report(row);
  };

  const committed =
    selectedId !== undefined && indexOf.has(selectedId) ? selectedId : null;

  /** The highlight back on the committed row, which shows no preview. */
  const rest = useCallback(() => {
    mode.current = "rest";
    setHighlightState(committed);
    report(null);
  }, [committed, report, setHighlightState]);

  useImperativeHandle(ref, () => ({ resetHighlight: rest }), [rest]);

  const setOpen = (next: boolean) => {
    if (next === open) return;
    // Cleared here as well as below, so the opening render is already
    // unfiltered rather than one pass later.
    if (next) onQueryChange("");
    setOpenState(next);
    onOpenChange?.(next);
  };

  // In an effect rather than setOpen, so a controlled `open` that the parent
  // flips gets the same reset and the same closing null.
  const wasOpen = useRef(false);
  const onQueryChangeRef = useRef(onQueryChange);
  onQueryChangeRef.current = onQueryChange;
  useLayoutEffect(() => {
    if (open === wasOpen.current) return;
    wasOpen.current = open;
    if (!open) report(null);
    else {
      setSubQuery(null);
      if (query !== "") onQueryChangeRef.current("");
    }
  }, [open, query, report]);

  const highlightIndex =
    highlight === null ? -1 : (indexOf.get(highlight) ?? -1);
  const parent = highlightIndex < 0 ? undefined : rows[highlightIndex];
  const hasSubmenu = (row: R) => (getSubmenu?.(row, "")?.length ?? 0) > 0;
  const subFilter =
    parent && hasSubmenu(parent) ? submenuFilter?.(parent) : undefined;
  const ownQuery =
    subFilter && subQuery && subQuery.parent === parent?.id ? subQuery : null;
  const subText = ownQuery?.text ?? "";
  const subRows = useMemo(
    () => (parent && getSubmenu?.(parent, subText)) || [],
    [parent, getSubmenu, subText],
  );
  const submenuOpen =
    open && moved && parent !== undefined && hasSubmenu(parent);
  const subBox = submenuOpen && subFilter !== undefined;
  const inSubBox = subBox && subKeys;
  const subIndex =
    subHighlight === null
      ? -1
      : subRows.findIndex((row) => row.id === subHighlight);

  // Radix only flips a side submenu to the other side and never shifts it
  // sideways, so where neither side has room it opens below the row instead.
  const [subBelow, setSubBelow] = useState(false);
  const placeSubmenu = useCallback(() => {
    const surface = content.current?.getBoundingClientRect();
    const width = submenu.current?.offsetWidth;
    if (!surface || !width) return;
    const room = document.documentElement.clientWidth;
    setSubBelow(surface.right + width > room && surface.left - width < 0);
  }, []);
  // Not an effect on opening: the portal mounts the submenu a commit later.
  const submenuRef = useCallback(
    (el: HTMLDivElement | null) => {
      submenu.current = el;
      if (el) placeSubmenu();
    },
    [placeSubmenu],
  );
  useEffect(() => {
    if (!submenuOpen) return;
    window.addEventListener("resize", placeSubmenu);
    return () => window.removeEventListener("resize", placeSubmenu);
  }, [submenuOpen, placeSubmenu]);

  // Typing puts the highlight on the best hit, so Enter takes it; clearing the
  // query puts it back on the committed row. Until the user moves it, it keeps
  // following those as the list changes (a late load, a filter that lags the
  // query); a row of theirs that leaves the list takes the highlight with it.
  const lastQuery = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      lastQuery.current = null;
      return;
    }
    if (lastQuery.current !== query) {
      const opening = lastQuery.current === null;
      lastQuery.current = query;
      mode.current = query === "" || opening ? "rest" : "hit";
    }
    if (mode.current === "rest") {
      setHighlightState(committed);
      report(null);
    } else if (mode.current === "hit") {
      const first = rows.find((row) => !row.disabled) ?? null;
      setHighlightState(first?.id ?? null);
      report(first);
    } else if (highlight !== null && !indexOf.has(highlight)) {
      setHighlightState(null);
      report(null);
    } else if (inSubBox && subMode.current === "hit") {
      const first = step(subRows, -1, 1) ?? null;
      if ((first?.id ?? null) !== subHighlight) {
        setSubHighlight(first?.id ?? null);
        report(first ?? parent ?? null);
      }
    } else if (subHighlight !== null && subIndex < 0) {
      // The submenu row is gone; the parent row still stands.
      setSubHighlight(null);
      report(parent ?? null);
    }
  }, [
    open,
    query,
    rows,
    indexOf,
    highlight,
    committed,
    report,
    setHighlightState,
    subHighlight,
    subIndex,
    subRows,
    inSubBox,
    parent,
  ]);

  // Focus follows whichever box has the keys. Only between the two boxes, or
  // back from nowhere when the submenu took the focused box away with it.
  useLayoutEffect(() => {
    if (!open) return;
    const target = inSubBox ? subInput.current : input.current;
    const active = document.activeElement;
    if (!target || active === target) return;
    if (
      active === null ||
      active === document.body ||
      active === input.current ||
      active === subInput.current
    ) {
      target.focus({ preventScroll: true });
    }
  }, [open, inSubBox]);
  const inSubBoxRef = useRef(inSubBox);
  inSubBoxRef.current = inSubBox;
  // The submenu mounts a render after it opens, so a box entered by → is not
  // there yet when the effect above runs.
  const subInputRef = useCallback((el: HTMLInputElement | null) => {
    subInput.current = el;
    if (el && inSubBoxRef.current) el.focus({ preventScroll: true });
  }, []);

  const revealHighlight = useRef(() => {});
  revealHighlight.current = () => {
    if (!open) return;
    const id =
      subIndex >= 0
        ? subOptionId(subIndex)
        : highlightIndex >= 0
          ? optionId(highlightIndex)
          : null;
    if (id) document.getElementById(id)?.scrollIntoView?.({ block: "nearest" });
  };
  useLayoutEffect(() => revealHighlight.current());
  // The effect above runs before the portal has mounted the list on open, and
  // the list only gets its height once the surface is placed, so the
  // committed row is revealed again as the list takes a size. Only until the
  // user scrolls it: a page scroll or a window resize resizes it as well.
  const revealOnResize = useRef(false);
  const stopRevealOnResize = () => {
    revealOnResize.current = false;
  };
  const listRef = useCallback((el: HTMLDivElement | null) => {
    list.current = el;
    if (el === null || typeof ResizeObserver === "undefined") return;
    revealOnResize.current = true;
    const observer = new ResizeObserver(() => {
      if (revealOnResize.current) revealHighlight.current();
    });
    observer.observe(el);
    // With a cleanup returned, React no longer calls the ref with null.
    return () => {
      observer.disconnect();
      list.current = null;
    };
  }, []);

  const clearGrace = useCallback(() => {
    grace.current = null;
    if (graceTimer.current !== null) clearTimeout(graceTimer.current);
    graceTimer.current = null;
  }, []);
  useEffect(() => clearGrace, [clearGrace]);
  useEffect(() => {
    if (!open) clearGrace();
  }, [open, clearGrace]);

  /** `heading: false` for the list's own leave, which fires where the row's did. */
  const inGrace = (event: PointerEvent, heading = true) => {
    const area = grace.current;
    if (area === null || Date.now() >= area.until) return false;
    // As Radix does, only while heading for the submenu's side: a pointer
    // moving straight down the list grazes the triangle's thin edge. A sample
    // with no sideways movement keeps the last direction.
    if (event.clientX !== area.x) {
      area.towards = area.right === event.clientX > area.x;
      area.x = event.clientX;
    }
    return (
      (area.towards || !heading) &&
      insidePolygon({ x: event.clientX, y: event.clientY }, area.polygon)
    );
  };

  /**
   * On the menu's own border where a submenu sits flush against it: the one
   * pixel between the list and the submenu, crossed either way.
   */
  const onSeam = (event: PointerEvent) => {
    const rect = submenu.current?.getBoundingClientRect();
    if (!rect || event.relatedTarget !== content.current) return false;
    const { clientX: x, clientY: y } = event;
    return (
      y >= rect.top &&
      y <= rect.bottom &&
      Math.min(Math.abs(x - rect.left), Math.abs(x - rect.right)) <= 2
    );
  };

  /** The highlight goes after `ms` unless the pointer is back in the list or the submenu. */
  const closeUnlessBack = (ms: number) => {
    if (graceTimer.current !== null) clearTimeout(graceTimer.current);
    graceTimer.current = setTimeout(() => {
      graceTimer.current = null;
      if (pointerIn.current === null) move(null);
    }, ms);
  };

  const choose = (row: R) => {
    if (row.disabled) return;
    onSelect(row);
    setOpen(false);
  };

  const moveIntoSubmenu = (row: R) => {
    mode.current = "user";
    subMode.current = "user";
    clearGrace();
    setMoved(true);
    setSubHighlight(row.id);
    report(row);
  };

  /** The submenu's filter box takes the keys; its highlight stays put. */
  const enterSubBox = () => {
    mode.current = "user";
    clearGrace();
    setMoved(true);
    setSubKeys(true);
  };

  const backToParent = () => {
    setSubHighlight(null);
    setSubKeys(false);
    subMode.current = "user";
    report(parent ?? null);
  };

  /** Both boxes' keys; `box` says which one they were pressed in. */
  const onKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    box: "menu" | "submenu",
  ) => {
    // Safari ends a composition with an Enter whose isComposing is already
    // false; keyCode 229 still marks it as the IME's.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    const inSubmenu = box === "submenu" || subIndex >= 0;
    const from = inSubmenu ? subRows : rows;
    const at = inSubmenu ? subIndex : highlightIndex;
    const field = event.currentTarget;
    let next: R | undefined;
    switch (event.key) {
      case "ArrowDown":
        next = step(from, at < 0 ? -1 : at, 1);
        break;
      case "ArrowUp":
        next = step(from, at < 0 ? from.length : at, -1);
        break;
      case "Home":
        next = step(from, -1, 1);
        break;
      case "End":
        next = step(from, from.length, -1);
        break;
      case "ArrowRight": {
        if (inSubmenu || field.selectionStart !== field.value.length) return;
        if (!parent || !hasSubmenu(parent)) return;
        const first = step(subRows, -1, 1);
        // A filter box is somewhere to go even with every row filtered out.
        if (!first && !subFilter) return;
        event.preventDefault();
        if (subFilter) enterSubBox();
        if (first) moveIntoSubmenu(first);
        return;
      }
      case "ArrowLeft":
        if (!inSubmenu) return;
        // The submenu's own box moves its caret first, as → does in the menu's.
        if (
          box === "submenu" &&
          (field.selectionStart !== 0 || field.selectionEnd !== 0)
        ) {
          return;
        }
        event.preventDefault();
        backToParent();
        return;
      case "Enter": {
        event.preventDefault();
        const row = at < 0 ? undefined : from[at];
        if (row) choose(row);
        return;
      }
      case "Tab":
        event.preventDefault();
        tabbing.current = event.shiftKey ? "backward" : "forward";
        setOpen(false);
        return;
      default:
        return;
    }
    event.preventDefault();
    if (!next) return;
    if (inSubmenu) moveIntoSubmenu(next);
    else move(next);
  };

  // The row's height and the surface's sides: the submenu sits against the
  // surface's border whatever the list's padding and scrollbar take.
  const anchorRow = useCallback((row: HTMLDivElement | null) => {
    anchor.current = row && {
      // Through it, floating-ui follows the row's scrolling and resizing.
      contextElement: row,
      getBoundingClientRect: () => {
        const own = row.getBoundingClientRect();
        const surface = content.current?.getBoundingClientRect() ?? own;
        return DOMRect.fromRect({
          x: surface.x,
          y: own.y,
          width: surface.width,
          height: own.height,
        });
      },
    };
  }, []);

  /** Leaving the parent row: the triangle toward the submenu's near edge. */
  const onParentLeave = (event: PointerEvent) => {
    const rect = submenu.current?.getBoundingClientRect();
    if (!rect) return;
    const right = rect.left >= event.clientX;
    const near = right ? rect.left : rect.right;
    const from = lastX.current ?? event.clientX;
    grace.current = {
      polygon: [
        { x: event.clientX + (right ? -5 : 5), y: event.clientY },
        { x: near, y: rect.top },
        { x: near, y: rect.bottom },
      ],
      until: Date.now() + GRACE_MS,
      right,
      x: event.clientX,
      towards: event.clientX !== from && right === event.clientX > from,
    };
  };

  let flatIndex = 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        asChild
        ref={trigger}
        // What a select's trigger does; a popover's opens on click alone.
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        ref={content}
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={cn(
          "flex max-h-[min(24rem,var(--radix-popover-content-available-height))] flex-col overflow-hidden p-0",
          className,
        )}
        // Pressing anything but a control (a row, the search icon, padding)
        // would move focus onto the surface, out of the box and its keys.
        onMouseDown={(event) => {
          if (!(event.target as Element).closest(FOCUSABLE)) {
            event.preventDefault();
          }
        }}
        onEscapeKeyDown={(event) => {
          // That Escape cancels the composition, not the menu.
          if (isEscapeOfComposition(event)) event.preventDefault();
        }}
        onOpenAutoFocus={(event) => {
          // The box, not the first tabbable, which may be in `header`.
          event.preventDefault();
          input.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          const direction = tabbing.current;
          tabbing.current = null;
          if (direction === null || !trigger.current) return;
          event.preventDefault();
          // The surface may already be gone by now, its ref with it.
          focusBeside(
            trigger.current,
            direction === "backward",
            content.current,
          );
        }}
      >
        <FilterBox
          ref={input}
          aria-label={inputLabel}
          expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            subIndex >= 0
              ? subOptionId(subIndex)
              : highlightIndex < 0
                ? undefined
                : optionId(highlightIndex)
          }
          placeholder={placeholder}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => onKeyDown(event, "menu")}
          // Pressed back into while the submenu's box had the keys.
          onFocus={() => {
            if (subKeys) backToParent();
          }}
        />
        {header}
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={listLabel}
          className="min-h-0 flex-1 overflow-y-auto p-1"
          onWheel={stopRevealOnResize}
          onTouchMove={stopRevealOnResize}
          // Where a drag of the scrollbar starts, too.
          onPointerDown={stopRevealOnResize}
          onPointerEnter={(event) => {
            pointerIn.current = "list";
            lastX.current = event.clientX;
          }}
          onPointerMove={(event) => {
            lastX.current = event.clientX;
          }}
          onPointerLeave={(event) => {
            pointerIn.current = null;
            const to = event.relatedTarget;
            if (to instanceof Node && submenu.current?.contains(to)) return;
            if (onSeam(event)) {
              // However long the pointer lingered on the scrollbar on its way.
              closeUnlessBack(GRACE_MS);
              return;
            }
            if (inGrace(event, false)) {
              // Crossing the gap toward the submenu; if the pointer never
              // arrives, the highlight still goes when the grace runs out.
              closeUnlessBack((grace.current?.until ?? 0) - Date.now());
              return;
            }
            if (highlight !== null) move(null);
          }}
        >
          {rows.length === 0 && (
            <div
              role="presentation"
              className="px-2 py-4 text-center text-muted-foreground text-sm"
            >
              {empty(query)}
            </div>
          )}
          {visible.map((section, sectionIndex) => {
            // By position: a section id may hold spaces, which would split
            // aria-labelledby's id list.
            const labelId = `${base}-section-${sectionIndex}`;
            const options = section.rows.map((row) => {
              const index = flatIndex++;
              const highlighted = index === highlightIndex;
              const selected = row.id === selectedId;
              const split = hasSubmenu(row);
              // One gutter for every row of a menu with submenus, so what
              // renderRow puts at the right edge lines up.
              const gutter = getSubmenu !== undefined;
              const cell = (
                <>
                  {renderRow(row, { highlighted, selected, query })}
                  {selected && (
                    <Mark
                      className={
                        split ? "right-0.5" : gutter ? "right-7" : "right-2"
                      }
                    >
                      <CheckIcon aria-hidden />
                    </Mark>
                  )}
                </>
              );
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: the filter box takes the keys; focus never comes here
                // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-expanded marks the option that owns a submenu listbox
                <div
                  key={row.id}
                  ref={highlighted ? anchorRow : undefined}
                  id={optionId(index)}
                  role="option"
                  tabIndex={-1}
                  aria-selected={highlighted && subIndex < 0}
                  aria-disabled={row.disabled || undefined}
                  aria-haspopup={split ? "listbox" : undefined}
                  aria-expanded={split ? highlighted && submenuOpen : undefined}
                  data-highlighted={highlighted ? "" : undefined}
                  data-selected={selected ? "" : undefined}
                  data-disabled={row.disabled ? "" : undefined}
                  className={
                    split
                      ? ROW_CLASS
                      : cn(OPTION_CLASS, gutter ? "pr-13" : "pr-8")
                  }
                  onPointerMove={(event) => {
                    if (row.disabled) return;
                    // A highlight resting here (the committed row, the first
                    // hit) still takes the hover, so its submenu opens; and
                    // back on the parent from its submenu's box, the keys
                    // come back too.
                    if (highlighted && moved && subIndex < 0 && !subKeys) {
                      return;
                    }
                    if (inGrace(event)) return;
                    clearGrace();
                    move(row);
                  }}
                  onPointerLeave={
                    highlighted && split ? onParentLeave : undefined
                  }
                  onClick={() => choose(row)}
                >
                  {split ? (
                    <span data-slot="submenu-action" className={ACTION_CLASS}>
                      {cell}
                    </span>
                  ) : (
                    cell
                  )}
                  {split && (
                    <span
                      aria-hidden
                      data-slot="submenu-trigger"
                      className="relative flex w-6.5 shrink-0 items-center justify-end self-stretch pr-2 text-muted-foreground group-aria-expanded/option:text-foreground"
                      // A split button's other half: it opens the submenu,
                      // where the rest of the row picks the row. A touch
                      // has no hover to open it any other way.
                      onClick={(event) => {
                        event.stopPropagation();
                        if (row.disabled || (highlighted && submenuOpen))
                          return;
                        clearGrace();
                        move(row);
                      }}
                    >
                      <span
                        data-slot="submenu-divider"
                        className="absolute inset-y-1.5 left-0 w-px bg-current opacity-20"
                      />
                      <ChevronRightIcon aria-hidden />
                    </span>
                  )}
                </div>
              );
            });
            return section.label === undefined ? (
              <Fragment key={section.id}>{options}</Fragment>
            ) : (
              // biome-ignore lint/a11y/useSemanticElements: a fieldset is not allowed in a listbox
              <div key={section.id} role="group" aria-labelledby={labelId}>
                <div
                  id={labelId}
                  className="px-1.5 py-1 text-muted-foreground text-xs"
                >
                  {section.label}
                </div>
                {options}
              </div>
            );
          })}
        </div>
        {footer}
        {/* Inside the parent's content, so Radix counts it as a child layer:
            pressing in it is not "outside" the menu. */}
        <Popover open={submenuOpen}>
          <PopoverAnchor virtualRef={anchor} />
          <PopoverContent
            ref={submenuRef}
            side={subBelow ? "bottom" : "right"}
            align="start"
            sideOffset={0}
            className={cn(
              "flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-60 flex-col overflow-hidden p-0",
              // placeSubmenu measures this width to decide whether it fits
              // beside the menu. Capped to the room beside it, it would
              // always fit, and stay there ever narrower instead of dropping.
              !subBelow && "max-w-none",
            )}
            style={
              ownQuery
                ? {
                    minHeight: `min(${ownQuery.height}px, var(--radix-popover-content-available-height))`,
                  }
                : undefined
            }
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              const target = event.target;
              if (target instanceof Node && content.current?.contains(target))
                event.preventDefault();
            }}
            // The topmost layer gets Escape, so the menu's own keys live here
            // while the submenu is open.
            onEscapeKeyDown={(event) => {
              event.preventDefault();
              if (isEscapeOfComposition(event)) return;
              if (subIndex >= 0 || inSubBox) backToParent();
              else setOpen(false);
            }}
            onMouseDown={(event) => {
              if (!(event.target as Element).closest(FOCUSABLE)) {
                event.preventDefault();
              }
            }}
            // Hover only: a tap's leave comes with the pointer lifting, not
            // moving off, and would close the submenu under the tap.
            onPointerEnter={(event) => {
              if (event.pointerType === "touch") return;
              pointerIn.current = "submenu";
              clearGrace();
              // Typing with the pointer over a submenu filters the submenu.
              if (subBox && !subKeys) enterSubBox();
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "touch") return;
              pointerIn.current = null;
              const to = event.relatedTarget;
              if (to instanceof Node && list.current?.contains(to)) return;
              if (onSeam(event)) closeUnlessBack(GRACE_MS);
              else move(null);
            }}
          >
            {subBox && parent && (
              <FilterBox
                ref={subInputRef}
                aria-label={
                  subFilter.label ??
                  (submenuLabel ? `Filter ${submenuLabel(parent)}` : "Filter")
                }
                expanded
                aria-controls={submenuId}
                aria-activedescendant={
                  subIndex < 0 ? undefined : subOptionId(subIndex)
                }
                placeholder={subFilter.placeholder ?? "Filter…"}
                value={subText}
                onChange={(event) => {
                  subMode.current = "hit";
                  setSubQuery({
                    parent: parent.id,
                    text: event.target.value,
                    height:
                      ownQuery?.height ??
                      submenu.current?.getBoundingClientRect().height ??
                      0,
                  });
                }}
                onKeyDown={(event) => onKeyDown(event, "submenu")}
                onFocus={() => {
                  if (!subKeys) enterSubBox();
                }}
              />
            )}
            <div
              id={submenuId}
              role="listbox"
              aria-label={parent ? submenuLabel?.(parent) : undefined}
              className="min-h-0 flex-1 overflow-y-auto p-1"
            >
              {/* Not while it fades out, emptied by the parent it lost. */}
              {submenuOpen && subRows.length === 0 && (
                <div
                  role="presentation"
                  className="px-2 py-4 text-center text-muted-foreground text-sm"
                >
                  {empty(subText)}
                </div>
              )}
              {subRows.map((row, index) => {
                const highlighted = index === subIndex;
                const selected = row.id === selectedSubmenuId;
                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: the filter box takes the keys; focus never comes here
                  <div
                    key={row.id}
                    id={subOptionId(index)}
                    role="option"
                    tabIndex={-1}
                    aria-selected={highlighted}
                    aria-disabled={row.disabled || undefined}
                    data-highlighted={highlighted ? "" : undefined}
                    data-selected={selected ? "" : undefined}
                    data-disabled={row.disabled ? "" : undefined}
                    className={cn(OPTION_CLASS, "pr-8")}
                    onPointerMove={() => {
                      if (!row.disabled && !highlighted) moveIntoSubmenu(row);
                    }}
                    onClick={() => choose(row)}
                  >
                    {renderRow(row, { highlighted, selected, query: subText })}
                    {selected && (
                      <Mark className="right-2">
                        <CheckIcon aria-hidden />
                      </Mark>
                    )}
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </PopoverContent>
    </Popover>
  );
}
