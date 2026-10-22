import { CheckIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import type {
  ComponentProps,
  KeyboardEvent,
  PointerEvent,
  ReactElement,
  ReactNode,
  Ref,
  RefObject,
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
  /** A row's submenu rows; undefined or empty = no submenu. Ids unique across the whole menu. */
  getSubmenu?: (row: R) => readonly R[] | undefined;
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

const OPTION_CLASS =
  "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pl-1.5 text-sm select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

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
  const reported = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const submenu = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement | null>(null);
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
    else if (query !== "") onQueryChangeRef.current("");
  }, [open, query, report]);

  const highlightIndex =
    highlight === null ? -1 : (indexOf.get(highlight) ?? -1);
  const parent = highlightIndex < 0 ? undefined : rows[highlightIndex];
  const subRows = useMemo(
    () => (parent && getSubmenu?.(parent)) || [],
    [parent, getSubmenu],
  );
  const submenuOpen = open && moved && subRows.length > 0;
  const subIndex =
    subHighlight === null
      ? -1
      : subRows.findIndex((row) => row.id === subHighlight);

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
    parent,
  ]);

  useLayoutEffect(() => {
    if (!open) return;
    const id =
      subIndex >= 0
        ? subOptionId(subIndex)
        : highlightIndex >= 0
          ? optionId(highlightIndex)
          : null;
    if (id) document.getElementById(id)?.scrollIntoView?.({ block: "nearest" });
  });

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

  const step = (from: readonly R[], at: number, by: 1 | -1): R | undefined => {
    for (let i = at + by; i >= 0 && i < from.length; i += by) {
      const row = from[i] as R;
      if (!row.disabled) return row;
    }
    return undefined;
  };

  const choose = (row: R) => {
    if (row.disabled) return;
    onSelect(row);
    setOpen(false);
  };

  const moveIntoSubmenu = (row: R) => {
    mode.current = "user";
    clearGrace();
    setMoved(true);
    setSubHighlight(row.id);
    report(row);
  };

  const backToParent = () => {
    setSubHighlight(null);
    report(parent ?? null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Safari ends a composition with an Enter whose isComposing is already
    // false; keyCode 229 still marks it as the IME's.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    const inSubmenu = subIndex >= 0;
    const from = inSubmenu ? subRows : rows;
    const at = inSubmenu ? subIndex : highlightIndex;
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
        const box = event.currentTarget;
        if (inSubmenu || box.selectionStart !== box.value.length) return;
        const first = step(subRows, -1, 1);
        if (!first) return;
        event.preventDefault();
        moveIntoSubmenu(first);
        return;
      }
      case "ArrowLeft":
        if (!inSubmenu) return;
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

  /** Leaving the parent row: the triangle toward the submenu's near edge. */
  const onParentLeave = (event: PointerEvent) => {
    const rect = submenu.current?.getBoundingClientRect();
    if (!rect) return;
    const right = rect.left >= event.clientX;
    const near = right ? rect.left : rect.right;
    grace.current = {
      polygon: [
        { x: event.clientX + (right ? -5 : 5), y: event.clientY },
        { x: near, y: rect.top },
        { x: near, y: rect.bottom },
      ],
      until: Date.now() + GRACE_MS,
      right,
      x: event.clientX,
      towards: false,
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
        <div className="flex items-center gap-2 border-b px-2.5">
          <SearchIcon
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-label={inputLabel}
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={
              subIndex >= 0
                ? subOptionId(subIndex)
                : highlightIndex < 0
                  ? undefined
                  : optionId(highlightIndex)
            }
            aria-autocomplete="list"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={placeholder}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onKeyDown}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {header}
        <div
          ref={list}
          id={listId}
          role="listbox"
          aria-label={listLabel}
          className="min-h-0 flex-1 overflow-y-auto p-1"
          onPointerEnter={() => {
            pointerIn.current = "list";
          }}
          onPointerLeave={(event) => {
            pointerIn.current = null;
            const to = event.relatedTarget;
            if (to instanceof Node && submenu.current?.contains(to)) return;
            if (inGrace(event, false)) {
              // Crossing the gap toward the submenu; if the pointer never
              // arrives, the highlight still goes when the grace runs out.
              const left = (grace.current?.until ?? 0) - Date.now();
              if (graceTimer.current !== null) clearTimeout(graceTimer.current);
              graceTimer.current = setTimeout(() => {
                graceTimer.current = null;
                if (pointerIn.current === null) move(null);
              }, left);
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
              const hasSubmenu = (getSubmenu?.(row)?.length ?? 0) > 0;
              // One gutter for every row of a menu with submenus, so what
              // renderRow puts at the right edge lines up.
              const gutter = getSubmenu !== undefined;
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: the filter box takes the keys; focus never comes here
                // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-expanded marks the option that owns a submenu listbox
                <div
                  key={row.id}
                  ref={highlighted ? anchor : undefined}
                  id={optionId(index)}
                  role="option"
                  tabIndex={-1}
                  aria-selected={highlighted && subIndex < 0}
                  aria-disabled={row.disabled || undefined}
                  aria-haspopup={hasSubmenu ? "listbox" : undefined}
                  aria-expanded={
                    hasSubmenu ? highlighted && submenuOpen : undefined
                  }
                  data-highlighted={highlighted ? "" : undefined}
                  data-selected={selected ? "" : undefined}
                  data-disabled={row.disabled ? "" : undefined}
                  className={cn(OPTION_CLASS, gutter ? "pr-13" : "pr-8")}
                  onPointerMove={(event) => {
                    if (row.disabled) return;
                    if (highlighted && subIndex < 0) return;
                    if (inGrace(event)) return;
                    clearGrace();
                    move(row);
                  }}
                  onPointerLeave={
                    highlighted && hasSubmenu ? onParentLeave : undefined
                  }
                  onClick={() => choose(row)}
                >
                  {renderRow(row, { highlighted, selected })}
                  {selected && (
                    <Mark className={gutter ? "right-7" : "right-2"}>
                      <CheckIcon aria-hidden />
                    </Mark>
                  )}
                  {hasSubmenu && (
                    <Mark className="right-2 text-muted-foreground">
                      <ChevronRightIcon aria-hidden />
                    </Mark>
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
          <PopoverAnchor virtualRef={anchor as RefObject<HTMLDivElement>} />
          <PopoverContent
            ref={submenu}
            side="right"
            align="start"
            sideOffset={4}
            className="w-60 p-1"
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
              if (subIndex >= 0) backToParent();
              else setOpen(false);
            }}
            onMouseDown={(event) => event.preventDefault()}
            onPointerEnter={() => {
              pointerIn.current = "submenu";
              clearGrace();
            }}
            onPointerLeave={(event) => {
              pointerIn.current = null;
              const to = event.relatedTarget;
              if (to instanceof Node && list.current?.contains(to)) return;
              move(null);
            }}
          >
            <div
              id={submenuId}
              role="listbox"
              aria-label={parent ? submenuLabel?.(parent) : undefined}
            >
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
                    {renderRow(row, { highlighted, selected })}
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
