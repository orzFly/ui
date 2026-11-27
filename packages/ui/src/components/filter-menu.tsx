import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { Slot, Toolbar as ToolbarPrimitive } from "radix-ui";
import type {
  ComponentProps,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactElement,
  ReactNode,
  Ref,
} from "react";
import {
  cloneElement,
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
import { usePointerHold } from "../hooks/use-pointer-hold.ts";
import { isModifiedClick } from "../lib/link.ts";
import { cn } from "../lib/utils.ts";
import { CheckboxMark } from "./checkbox/mark.tsx";
import {
  FilterBox,
  finePointer,
  isComposing,
} from "./dropdown-menu/filter-box.tsx";
import { DropdownMenuItem } from "./dropdown-menu.tsx";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "./popover.tsx";
import { RovingTaken } from "./toolbar/command.tsx";
import { OverflowName, OverflowValue } from "./toolbar/overflow.tsx";
import {
  OUT_OF_FLOW,
  slotProps,
  ToolbarItemContext,
  type ToolbarPriority,
  useToolbarUnit,
} from "./toolbar/store.ts";

export interface FilterMenuRow {
  /** Unique across every section. */
  id: string;
  disabled?: boolean;
  /**
   * Does something when picked rather than being one of the choices:
   * `Create “…”`, a completion that fills the box. It is never checked and
   * wears no mark, and under multiple selection no box.
   */
  action?: boolean;
}

export interface FilterMenuSection<R extends FilterMenuRow> {
  id: string;
  label?: ReactNode;
  rows: readonly R[];
}

export interface FilterMenuRowState {
  highlighted: boolean;
  /** Single: the committed row. Multiple: in `selectedIds`. */
  selected: boolean;
  /** Multiple: in `mixedIds` and not in `selectedIds`. Always false under single. */
  mixed: boolean;
  /** What the row's own list is filtered by: the menu's query, or its submenu's. */
  query: string;
}

export interface FilterMenuSelectEvent {
  /**
   * What the pick asks the row to become. Single: always true. Multiple:
   * false for a selected row, true for any other (a mixed row becomes
   * selected), except a row `mixed` asks back.
   */
  readonly selected: boolean;
  /**
   * Multiple: the pick asks a row that was in `mixedIds` as the menu opened,
   * and is now in neither list, to be partly selected again: back on just
   * the items it was on. Such a row goes mixed, selected, unselected and
   * round again. Always false under single.
   */
  readonly mixed: boolean;
  /**
   * Single: the menu stays open, its focus, query and highlight as they are;
   * close it through `open` when done. Multiple: the menu stays open anyway.
   */
  preventDefault(): void;
  readonly defaultPrevented: boolean;
}

export interface FilterMenuSubmenuFilter {
  placeholder?: string;
  /** Defaults to "Filter" and the submenu's label. */
  label?: string;
}

export interface FilterMenuHandle {
  /**
   * The highlight back on `selectedId`, or on no row under multiple
   * selection, firing `onHighlight(null)`; for a control in `header` that
   * commits at once.
   */
  resetHighlight(): void;
}

type FilterMenuSelection =
  | {
      /** One row at a time; picking one closes the menu. The default. */
      selection?: "single";
      /** The committed row: checked, and where the highlight rests when nobody moved it. */
      selectedId?: string;
      /** The committed row inside a submenu: checked there. */
      selectedSubmenuId?: string;
      selectedIds?: never;
      mixedIds?: never;
    }
  | {
      /** Each row on or off by itself; the menu stays open. */
      selection: "multiple";
      /** Selected rows, in the menu and its submenus alike. */
      selectedIds: readonly string[];
      /** Rows partly selected: a label on some of the items being edited. */
      mixedIds?: readonly string[];
      selectedId?: never;
      selectedSubmenuId?: never;
    };

export type FilterMenuProps<R extends FilterMenuRow> = FilterMenuBaseProps<R> &
  FilterMenuSelection;

export interface FilterMenuBaseProps<R extends FilterMenuRow> {
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
  /**
   * The row the user moved the highlight to, by key, pointer or typing.
   * `null` means "show the committed state": the highlight rests on
   * `selectedId` untouched, the pointer left the list, or the menu closed.
   */
  onHighlight?: (row: R | null) => void;
  /**
   * A row was picked, by a click or Enter. Under single selection the menu
   * closes after it unless `event.preventDefault()` is called; under multiple
   * it stays open, and the row stays as it is until `selectedIds` and
   * `mixedIds` say otherwise. A `rowLink` row has gone by its link by then,
   * so this only hears of it.
   */
  onSelect?: (row: R, event: FilterMenuSelectEvent) => void;
  /**
   * Where a row that is a place goes: its `href`, drawn as an `a`, or a
   * router's link with no children, which the row is drawn as, its content
   * inside. A plain click or Enter goes there and closes the menu; a click
   * with a modifier, a middle click or a right click is the browser's (a new
   * tab, a window, the link's own menu), and the menu stays open. Undefined
   * for a row that is no place. Under multiple selection a link row is
   * picked as an `action` row is, never checked.
   */
  rowLink?: (row: R) => string | ReactElement | undefined;
  /**
   * A row's submenu rows, filtered for `query`: what its filter box holds, or
   * `""` without one. Undefined or empty for `""` = no submenu. Ids unique
   * across the whole menu.
   */
  getSubmenu?: (row: R, query: string) => readonly R[] | undefined;
  /** Gives a row's submenu its own filter box; undefined = none. */
  submenuFilter?: (row: R) => FilterMenuSubmenuFilter | undefined;
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
  /** In a `Toolbar`, how soon it gives up room. Outside one it is ignored. */
  priority?: ToolbarPriority;
  /**
   * In a `Toolbar`, set away from its default: it leaves the bar last within
   * its `priority`, and is counted on the ⋯ while it is in there. Outside
   * one it is ignored.
   */
  toolbarActive?: boolean;
  /** Its row's name in the ⋯ menu; `listLabel` by default. */
  toolbarLabel?: ReactNode;
  /** What it is set to, after its name in the ⋯ menu (`Open`, `Alice`). */
  toolbarValue?: ReactNode;
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

/** A key that types a character, rather than moving or acting. */
const types = (event: KeyboardEvent) =>
  [...event.key].length === 1 && !event.ctrlKey && !event.metaKey;

/** Keys that move the highlight, which the box's `aria-activedescendant` reports. */
const MOVES = new Set([
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
]);

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

// Under raymond the highlighted row fills with the highlight colour, the
// palette's primary, as DropdownMenu's items do.
const ROW_CLASS =
  "group/option relative flex w-full cursor-default items-center rounded-item text-ui min-h-row touch:min-h-touch select-none raymond:[--accent-foreground:var(--primary-foreground)] raymond:[--accent:var(--primary)] data-disabled:pointer-events-none data-disabled:opacity-50 raymond:data-disabled:opacity-100 raymond:data-disabled:text-(--3d-shadow) raymond:data-disabled:[text-shadow:1px_1px_var(--3d-highlight)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const CELL_CLASS = "gap-1.5 py-1 pl-1.5";

// A checkbox's mark keeps the window's text colour under raymond: its dash
// is drawn in the current colour, which would go white on the box's white.
const OPTION_CLASS = cn(
  ROW_CLASS,
  CELL_CLASS,
  "data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:state-cue raymond:data-highlighted:**:not-data-[slot=checkbox-mark]:not-in-data-[slot=checkbox-mark]:text-accent-foreground",
);

/**
 * A split row's left half, the part that picks the row. Only it lights up:
 * the chevron's half opens the submenu, which hovering the row already did.
 */
const ACTION_CLASS = cn(
  "relative flex min-w-0 flex-1 items-center self-stretch rounded-item pr-6.5",
  CELL_CLASS,
  "group-data-highlighted/option:bg-accent group-data-highlighted/option:text-accent-foreground group-data-highlighted/option:state-cue raymond:group-data-highlighted/option:**:not-data-[slot=checkbox-mark]:not-in-data-[slot=checkbox-mark]:text-accent-foreground",
);

/**
 * A row's box under multiple selection. Under raymond the box is 13px, and
 * 3px of margin give it an icon's 16px, so an action row's icon stands in its
 * column and the names line up. On the highlight's fill the empty box's
 * input-coloured edge falls under 3:1 in most palettes; the row's text
 * colour holds it.
 */
const BOX_CLASS =
  "raymond:mr-0.5 raymond:ml-px group-data-highlighted/option:data-[state=unchecked]:border-accent-foreground";

/**
 * A row's cell under multiple selection. Under raymond a row is as tall as
 * its text, 21px: with less padding a 16px icon, an action row's, no longer
 * makes its row taller than a 13px box does.
 */
const MULTIPLE_CELL = "raymond:py-0.5";

/**
 * A row's part in the selection; `null` for a row that is no choice: an
 * action, or under multiple selection a link.
 */
type Pick = "selected" | "mixed" | "unselected" | null;

const BOX_STATE = {
  selected: "checked",
  mixed: "indeterminate",
  unselected: "unchecked",
} as const;

const ARIA_CHECKED = {
  selected: true,
  mixed: "mixed",
  unselected: false,
} as const;

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

/**
 * A popover with a filter box over a list, the combobox pattern: focus stays
 * in the box, so typing always filters, and the arrow keys walk a highlight
 * that `aria-activedescendant` follows. The caller filters; this component
 * owns the surface, the highlight and the keys.
 *
 * Under `selection="multiple"` each row is on or off by itself, drawn with a
 * checkbox's look, a partly selected one with its dash; a pick leaves the
 * menu open, and what is selected is the caller's to say.
 *
 * Without a fine pointer, on a touch screen, it opens with the focus on the
 * list instead, so no on-screen keyboard rises over the rows: a tap on the
 * box brings the keyboard, and a key pressed on a hardware one moves the
 * focus into the box, which takes that key as its own.
 *
 * In a `Toolbar` its trigger is one of the bar's commands. Moved into the ⋯
 * menu it is a row there, naming it and its value, which opens the menu
 * against the ⋯ and hands the focus back to it on closing.
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
  selection = "single",
  selectedId,
  selectedIds,
  mixedIds,
  onHighlight,
  onSelect,
  rowLink,
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
  priority,
  toolbarActive,
  toolbarLabel,
  toolbarValue,
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
  const interactedOutside = useRef(false);
  const openRef = useRef<(next: boolean) => void>(() => {});
  // Mounted: open, or fading out after closing.
  const [surface, setSurface] = useState(false);
  const contentRef = useCallback((el: HTMLDivElement | null) => {
    content.current = el;
    setSurface(el !== null);
  }, []);
  const unit = useToolbarUnit({
    meta: {
      priority,
      active: toolbarActive,
      overflowable: true,
      // A pick widens or narrows the trigger and sets it away from its
      // default, and the bar would move it to or from the ⋯, the surface
      // with it. Held until the surface has gone, it is laid out again only
      // then, before the focus goes back.
      held: open || surface,
      renderOverflow: () => (
        <DropdownMenuItem
          onSelect={() => {
            unit.internal?.store.closeOverflow({ restoreFocus: false });
            // Once the ⋯ menu has let go of the focus, which this one's box takes.
            queueMicrotask(() => openRef.current(true));
          }}
        >
          <OverflowName
            marked={toolbarActive === true && toolbarValue === undefined}
          >
            {toolbarLabel ?? listLabel}
          </OverflowName>
          {toolbarValue !== undefined && (
            <OverflowValue active={toolbarActive}>{toolbarValue}</OverflowValue>
          )}
          <ChevronRightIcon aria-hidden />
        </DropdownMenuItem>
      ),
    },
  });
  const overflowed = unit.view === "overflow";
  const moreRef = unit.internal?.store.triggerRef;
  // Whether the surface stands against the ⋯, for the focus on closing, by
  // when the bar may have put the trigger back.
  const fromMore = useRef(false);
  if (open) fromMore.current = overflowed;

  // A pick re-lays the bar out, or the caller's row, and moves the trigger
  // or the ⋯; the surface stands where it was while the pointer is on it or
  // near it, so no row slides out from under the pointer, and slides over to
  // its anchor once the pointer has gone.
  const holding = usePointerHold(
    () => [content.current, submenu.current],
    open,
  );
  const anchorOf = useCallback(
    () => (overflowed ? moreRef?.current : null) ?? trigger.current,
    [overflowed, moreRef],
  );
  const [pin, setPin] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    setPin(holding ? (anchorOf()?.getBoundingClientRect() ?? null) : null);
  }, [holding, anchorOf]);
  // A new one at each opening, which Radix hands to the surface anew: until
  // it learns of this anchor, the trigger is its own, and React's strict mode
  // attaches that again after this one, by then a trigger since replaced.
  const placed = useMemo(
    () => ({
      // Read by floating-ui as it starts following the anchor, by then mounted.
      get contextElement() {
        return anchorOf() ?? undefined;
      },
      getBoundingClientRect: () =>
        (open ? pin : null) ??
        anchorOf()?.getBoundingClientRect() ??
        new DOMRect(),
    }),
    [open, pin, anchorOf],
  );
  const wasPinned = useRef(false);
  useLayoutEffect(() => {
    const was = wasPinned.current;
    wasPinned.current = pin !== null;
    const surface = content.current;
    const wrapper = surface?.parentElement;
    if (!was || pin !== null || !open || !surface || !wrapper) return;
    // How long the slide takes is the style's, in the surface's class.
    const duration = getComputedStyle(surface)
      .getPropertyValue("--filter-menu-slide")
      .trim();
    if (duration === "" || Number.parseFloat(duration) === 0) return;
    // On the wrapper floating-ui places by its transform, which it sets anew
    // once it has heard of the anchor's change, after this commit.
    wrapper.style.transition = `transform ${duration} ease-out`;
    const done = () => {
      wrapper.style.transition = "";
    };
    wrapper.addEventListener("transitionend", done, { once: true });
    const timer = setTimeout(done, 1000);
    return () => clearTimeout(timer);
  }, [pin, open]);

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

  const multiple = selection === "multiple";
  // Under multiple selection no row is the one committed, so the highlight
  // rests on none: on opening, with the box cleared, and once reset.
  const committed =
    !multiple && selectedId !== undefined && indexOf.has(selectedId)
      ? selectedId
      : null;
  const picked = useMemo(() => new Set(selectedIds), [selectedIds]);
  const partly = useMemo(() => new Set(mixedIds), [mixedIds]);
  // The rows partly selected as the menu opened, which a pick cycles back
  // to: the caller's ids change with every pick.
  const mixedAtOpen = useRef<ReadonlySet<string>>(new Set());
  const openSeen = useRef(false);
  if (open !== openSeen.current) {
    openSeen.current = open;
    if (open) {
      mixedAtOpen.current = new Set(
        [...partly].filter((id) => !picked.has(id)),
      );
    }
  }
  const pickOf = (row: R, inSubmenu: boolean): Pick => {
    if (row.action) return null;
    if (!multiple) {
      const id = inSubmenu ? selectedSubmenuId : selectedId;
      return row.id === id ? "selected" : "unselected";
    }
    if (rowLink?.(row) !== undefined) return null;
    if (picked.has(row.id)) return "selected";
    return partly.has(row.id) ? "mixed" : "unselected";
  };
  /** The box a row wears before its content under multiple selection. */
  const boxOf = (pick: Pick) =>
    multiple && pick !== null ? (
      <CheckboxMark state={BOX_STATE[pick]} className={BOX_CLASS} />
    ) : null;
  // Under multiple selection the state is the row's own, and aria-selected,
  // which a single one's highlight carries, would say it twice.
  const checkedOf = (pick: Pick) =>
    multiple && pick !== null ? ARIA_CHECKED[pick] : undefined;

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
  openRef.current = setOpen;

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

  /** What a pick asks the row to become: partly selected rows cycle through all, none, and back. */
  const nextOf = (row: R, inSubmenu: boolean) => {
    const pick = multiple ? pickOf(row, inSubmenu) : null;
    if (pick === "selected") return { selected: false, mixed: false };
    if (pick === "unselected" && mixedAtOpen.current.has(row.id)) {
      return { selected: false, mixed: true };
    }
    return { selected: true, mixed: false };
  };

  /** `by` a key, or a pointer: a touch or a pen, which hovers nothing, leaves no highlight behind. */
  const choose = (row: R, inSubmenu: boolean, by: "key" | "pointer") => {
    if (row.disabled) return;
    let prevented = false;
    const event: FilterMenuSelectEvent = {
      ...nextOf(row, inSubmenu),
      preventDefault: () => {
        prevented = true;
      },
      get defaultPrevented() {
        return prevented;
      },
    };
    onSelect?.(row, event);
    if (!multiple && !prevented) {
      setOpen(false);
      return;
    }
    // Staying open, the highlight stays on the row as the caller's data
    // changes under it, until the query does; the box and the focus are left
    // as they are. A highlight a touch left would read as the row picked.
    const lifted =
      by === "pointer" &&
      (pressedWith.current === "touch" || pressedWith.current === "pen");
    if (lifted) {
      if (inSubmenu) {
        // The parent keeps it, and with it its submenu open.
        mode.current = "user";
        subMode.current = "user";
        setSubHighlight(null);
        report(parent ?? null);
      } else {
        mode.current = "rest";
        setHighlightState(committed);
        report(null);
      }
      return;
    }
    mode.current = "user";
    if (inSubmenu) {
      subMode.current = "user";
      if (subHighlight !== row.id) {
        setSubHighlight(row.id);
        report(row);
      }
    } else if (highlight !== row.id) {
      // A tap, which moved no highlight: picking a parent opens no submenu.
      setHighlightState(row.id);
      report(row);
    }
  };

  /**
   * A row's click. A link row goes by its link, whether the browser follows
   * it, a router's link takes it over after this, or the caller's own
   * handler did before; this only closes the menu, and leaves a click with a
   * modifier to the browser. Preventing the default here would stop a
   * router's link, which goes only for a click nobody handled.
   */
  const onRowClick = (
    event: MouseEvent<HTMLElement>,
    row: R,
    inSubmenu: boolean,
  ) => {
    const by = clickedByKey.current ? "key" : "pointer";
    if (!event.currentTarget.matches("a[href]")) {
      choose(row, inSubmenu, by);
      return;
    }
    if (row.disabled) {
      event.preventDefault();
      return;
    }
    if (!isModifiedClick(event)) choose(row, inSubmenu, by);
  };

  const linkOf = (row: R): ReactElement | undefined => {
    const link = rowLink?.(row);
    // biome-ignore lint/a11y/useAnchorContent: the row's content goes inside
    return typeof link === "string" ? <a href={link} /> : link;
  };

  /** Enter: a link row is clicked, so it goes as a plain click would. */
  const clickedByKey = useRef(false);
  const activate = (row: R, id: string, inSubmenu: boolean) => {
    const el = document.getElementById(id);
    if (!el?.matches("a[href]")) {
      choose(row, inSubmenu, "key");
      return;
    }
    clickedByKey.current = true;
    try {
      el.click();
    } finally {
      clickedByKey.current = false;
    }
  };

  // What the last press on the surface came from: only a mouse drags a link.
  const pressedWith = useRef<string | null>(null);
  const pressOver = useRef<AbortController | null>(null);
  useEffect(() => () => pressOver.current?.abort(), []);
  /**
   * Pressing anything but a control (a row, the search icon, padding) would
   * move focus onto the surface, out of the box and its keys. A link row
   * pressed with the mouse's left button is the exception: the browser starts
   * a drag of it (onto the bookmarks bar, into another tab) only from a press
   * that moved the focus to it, so the box takes the focus back once the
   * press is over, on its release or the drag's end.
   */
  const onSurfaceMouseDown = (event: MouseEvent) => {
    const target = event.target as Element;
    const row = target.closest('[role="option"]');
    const control = target.closest(FOCUSABLE);
    if (control !== null && control !== row) return;
    const drag =
      row?.matches("a[href]") &&
      event.button === 0 &&
      pressedWith.current === "mouse";
    if (!drag) {
      event.preventDefault();
      return;
    }
    // Opened without a fine pointer, the list holds the focus, and the box
    // taking it back would raise the on-screen keyboard.
    const held = document.activeElement === list.current ? list.current : null;
    pressOver.current?.abort();
    const over = new AbortController();
    pressOver.current = over;
    const back = () => {
      over.abort();
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        active.matches('[role="option"]') &&
        (list.current?.contains(active) || submenu.current?.contains(active))
      ) {
        const box = inSubBoxRef.current ? subInput.current : input.current;
        (held ?? box)?.focus({ preventScroll: true });
      }
    };
    const options = { capture: true, signal: over.signal };
    window.addEventListener("mouseup", back, options);
    window.addEventListener("dragend", back, options);
  };
  const onSurfacePointerDown = (event: PointerEvent) => {
    pressedWith.current = event.pointerType;
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

  /** Both boxes' keys; `box` says which one they are for, `field` is that box. */
  const onKeyDown = (
    event: KeyboardEvent,
    box: "menu" | "submenu",
    field: HTMLInputElement,
  ) => {
    // Safari ends a composition with an Enter whose isComposing is already
    // false; keyCode 229 still marks it as the IME's.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    const inSubmenu = box === "submenu" || subIndex >= 0;
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
        if (row) {
          activate(row, inSubmenu ? subOptionId(at) : optionId(at), inSubmenu);
        }
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

  /**
   * The list's keys, which only a hardware keyboard sends: it holds the focus
   * only when opened without a fine pointer. The box takes the focus for a key
   * that types or moves the highlight, which it reports; Enter and Tab act
   * from here.
   */
  const onListKeyDown = (event: KeyboardEvent) => {
    const sub = inSubBox ? subInput.current : null;
    const box = sub ?? input.current;
    if (!box) return;
    if (types(event) || MOVES.has(event.key)) {
      box.focus({ preventScroll: true });
    }
    // A character is left to the browser, which types it where the focus
    // now is.
    if (!types(event)) onKeyDown(event, sub ? "submenu" : "menu", box);
  };

  // The row's height and the surface's sides: the submenu sits against the
  // surface's border whatever the list's padding and scrollbar take.
  const anchorRow = useCallback((row: HTMLElement | null) => {
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
  const triggerPart = (
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
      {unit.registered ? (
        <ToolbarPrimitive.Button asChild>{children}</ToolbarPrimitive.Button>
      ) : (
        children
      )}
    </PopoverTrigger>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {unit.registered ? (
        <ToolbarItemContext.Provider value={unit.item}>
          <span
            ref={unit.ref}
            {...slotProps(overflowed)}
            data-slot="toolbar-item"
            className={cn(
              "inline-flex shrink-0 items-center",
              overflowed && OUT_OF_FLOW,
            )}
          >
            <RovingTaken.Provider value>{triggerPart}</RovingTaken.Provider>
          </span>
        </ToolbarItemContext.Provider>
      ) : (
        triggerPart
      )}
      {/* The ⋯ while it is in the ⋯ menu, its own trigger out of sight;
          held in place while the pointer is near. Always mounted: Radix
          wraps the trigger in an anchor of its own only without one, and
          swapping the wrapper in and out remounts the trigger. */}
      <PopoverAnchor virtualRef={{ current: placed }} />
      <PopoverContent
        ref={contentRef}
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={cn(
          // Under raymond nothing slides, as nothing did in Windows 2000.
          "flex max-h-[min(24rem,var(--radix-popover-content-available-height))] flex-col overflow-hidden p-0 [--filter-menu-slide:150ms] motion-reduce:[--filter-menu-slide:0s] raymond:[--filter-menu-slide:0s]",
          className,
        )}
        onPointerDown={onSurfacePointerDown}
        onMouseDown={onSurfaceMouseDown}
        onEscapeKeyDown={(event) => {
          // That Escape cancels the composition, not the menu.
          if (isComposing(event)) event.preventDefault();
        }}
        onOpenAutoFocus={(event) => {
          // The box, not the first tabbable, which may be in `header`. Without
          // a fine pointer the list: the box would raise the on-screen
          // keyboard over the rows before anyone asked to type.
          event.preventDefault();
          const target = finePointer(trigger.current)
            ? input.current
            : list.current;
          target?.focus({ preventScroll: true });
        }}
        onInteractOutside={(event) => {
          if (!event.defaultPrevented) interactedOutside.current = true;
        }}
        onCloseAutoFocus={(event) => {
          const direction = tabbing.current;
          tabbing.current = null;
          const outside = interactedOutside.current;
          interactedOutside.current = false;
          // Radix calls this a task after the surface has gone, the focus
          // having fallen from it to the body. Found anywhere else, it was
          // put there since, as another menu opening does, and taking it back
          // would close that menu. An exit animation keeps this surface
          // listening long enough to see the move as an outside interaction;
          // without one, nothing else tells it.
          const active = document.activeElement;
          if (active !== null && active !== document.body) {
            event.preventDefault();
            return;
          }
          // Opened from the ⋯ menu, it goes back to the ⋯. The bar, laid out
          // again as the surface went, may have moved the trigger since: into
          // the ⋯, which takes the focus for it, or back onto the bar with
          // the ⋯ gone, so the trigger takes it. Read from the store: this
          // handler is the one the surface last rendered with. A click
          // elsewhere has put the focus there.
          const inMore =
            unit.registered &&
            unit.internal?.store.viewOf(unit.id) === "overflow";
          const more =
            (fromMore.current || inMore) && moreRef?.current
              ? moreRef.current
              : null;
          fromMore.current = false;
          const from = more ?? trigger.current;
          if (direction === null) {
            if (outside || !from) return;
            event.preventDefault();
            from.focus({ preventScroll: true });
            // A ToolbarOverflow with nothing in it is held out of sight.
            if (from === more && document.activeElement !== more) {
              trigger.current?.focus({ preventScroll: true });
            }
            return;
          }
          if (!from) return;
          event.preventDefault();
          // The surface may already be gone by now, its ref with it.
          focusBeside(from, direction === "backward", content.current);
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
          onKeyDown={(event) => onKeyDown(event, "menu", event.currentTarget)}
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
          aria-multiselectable={multiple || undefined}
          // Where the focus lands without a fine pointer. No ring: the
          // highlight shows where the keys act, as it does from the box.
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto p-1 outline-none"
          onKeyDown={onListKeyDown}
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
              className="px-2 py-4 text-center text-muted-foreground text-ui"
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
              const pick = pickOf(row, false);
              const selected = pick === "selected";
              const split = hasSubmenu(row);
              // One gutter for every row of a menu with submenus, so what
              // renderRow puts at the right edge lines up.
              const gutter = getSubmenu !== undefined;
              const cell = (
                <>
                  {boxOf(pick)}
                  {renderRow(row, {
                    highlighted,
                    selected,
                    mixed: pick === "mixed",
                    query,
                  })}
                  {!multiple && selected && (
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
              const link = linkOf(row);
              const Row = link ? Slot.Root : "div";
              const content = (
                <>
                  {split ? (
                    <span
                      data-slot="submenu-action"
                      className={
                        multiple
                          ? cn(ACTION_CLASS, "pr-1.5", MULTIPLE_CELL)
                          : ACTION_CLASS
                      }
                    >
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
                      // has no hover to open it any other way. In a link
                      // row it goes nowhere.
                      onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
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
                </>
              );
              return (
                <Row
                  key={row.id}
                  ref={highlighted ? anchorRow : undefined}
                  id={optionId(index)}
                  role="option"
                  tabIndex={-1}
                  aria-selected={
                    multiple ? undefined : highlighted && subIndex < 0
                  }
                  aria-checked={checkedOf(pick)}
                  aria-disabled={row.disabled || undefined}
                  aria-haspopup={split ? "listbox" : undefined}
                  aria-expanded={split ? highlighted && submenuOpen : undefined}
                  data-highlighted={highlighted ? "" : undefined}
                  data-selected={selected ? "" : undefined}
                  data-disabled={row.disabled ? "" : undefined}
                  className={
                    split
                      ? ROW_CLASS
                      : cn(
                          OPTION_CLASS,
                          // Room after the content for the check, which a
                          // box before it replaces, and in a menu with
                          // submenus for the chevron.
                          multiple
                            ? [gutter ? "pr-8" : "pr-1.5", MULTIPLE_CELL]
                            : gutter
                              ? "pr-13"
                              : "pr-8",
                        )
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
                  onClick={(event: MouseEvent<HTMLElement>) =>
                    onRowClick(event, row, false)
                  }
                >
                  {link ? cloneElement(link, undefined, content) : content}
                </Row>
              );
            });
            return section.label === undefined ? (
              <Fragment key={section.id}>{options}</Fragment>
            ) : (
              // biome-ignore lint/a11y/useSemanticElements: a fieldset is not allowed in a listbox
              <div key={section.id} role="group" aria-labelledby={labelId}>
                <div
                  id={labelId}
                  className="px-1.5 py-1 text-muted-foreground text-ui-sm"
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
              if (isComposing(event)) return;
              if (subIndex >= 0 || inSubBox) backToParent();
              else setOpen(false);
            }}
            onPointerDown={onSurfacePointerDown}
            onMouseDown={onSurfaceMouseDown}
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
                onKeyDown={(event) =>
                  onKeyDown(event, "submenu", event.currentTarget)
                }
                onFocus={() => {
                  if (!subKeys) enterSubBox();
                }}
              />
            )}
            <div
              id={submenuId}
              role="listbox"
              aria-label={parent ? submenuLabel?.(parent) : undefined}
              aria-multiselectable={multiple || undefined}
              className="min-h-0 flex-1 overflow-y-auto p-1"
            >
              {/* Not while it fades out, emptied by the parent it lost. */}
              {submenuOpen && subRows.length === 0 && (
                <div
                  role="presentation"
                  className="px-2 py-4 text-center text-muted-foreground text-ui"
                >
                  {empty(subText)}
                </div>
              )}
              {subRows.map((row, index) => {
                const highlighted = index === subIndex;
                const pick = pickOf(row, true);
                const selected = pick === "selected";
                const link = linkOf(row);
                const Row = link ? Slot.Root : "div";
                const content = (
                  <>
                    {boxOf(pick)}
                    {renderRow(row, {
                      highlighted,
                      selected,
                      mixed: pick === "mixed",
                      query: subText,
                    })}
                    {!multiple && selected && (
                      <Mark className="right-2">
                        <CheckIcon aria-hidden />
                      </Mark>
                    )}
                  </>
                );
                return (
                  <Row
                    key={row.id}
                    id={subOptionId(index)}
                    role="option"
                    tabIndex={-1}
                    aria-selected={multiple ? undefined : highlighted}
                    aria-checked={checkedOf(pick)}
                    aria-disabled={row.disabled || undefined}
                    data-highlighted={highlighted ? "" : undefined}
                    data-selected={selected ? "" : undefined}
                    data-disabled={row.disabled ? "" : undefined}
                    className={cn(
                      OPTION_CLASS,
                      multiple ? ["pr-1.5", MULTIPLE_CELL] : "pr-8",
                    )}
                    onPointerMove={() => {
                      if (!row.disabled && !highlighted) moveIntoSubmenu(row);
                    }}
                    onClick={(event: MouseEvent<HTMLElement>) =>
                      onRowClick(event, row, true)
                    }
                  >
                    {link ? cloneElement(link, undefined, content) : content}
                  </Row>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </PopoverContent>
    </Popover>
  );
}
