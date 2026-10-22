import { CheckIcon, SearchIcon } from "lucide-react";
import type {
  ComponentProps,
  KeyboardEvent,
  ReactElement,
  ReactNode,
  Ref,
} from "react";
import {
  Fragment,
  useCallback,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../lib/utils.ts";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.tsx";

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
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
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
  const [highlight, setHighlightState] = useState<string | null>(null);
  const reported = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const tabbing = useRef<"forward" | "backward" | null>(null);
  const base = useId();
  const listId = `${base}-list`;

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

  const onHighlightRef = useRef(onHighlight);
  onHighlightRef.current = onHighlight;
  const report = useCallback((row: R | null) => {
    const id = row?.id ?? null;
    if (reported.current === id) return;
    reported.current = id;
    onHighlightRef.current?.(row);
  }, []);

  /** A highlight the user moved, reported as such. */
  const move = (row: R | null) => {
    setHighlightState(row?.id ?? null);
    report(row);
  };

  /** The highlight back on the committed row, which shows no preview. */
  const rest = useCallback(() => {
    setHighlightState(selectedId ?? null);
    report(null);
  }, [selectedId, report]);

  useImperativeHandle(ref, () => ({ resetHighlight: rest }), [rest]);

  const setOpen = (next: boolean) => {
    if (next === open) return;
    if (next) onQueryChange("");
    else report(null);
    setOpenState(next);
    onOpenChange?.(next);
  };

  // Typing puts the highlight on the best hit, so Enter takes it; clearing the
  // query puts it back on the committed row. Otherwise the list changed under
  // the highlight (another tab, a late load), which may take its row away.
  // One effect, because both read the highlight a single commit leaves.
  const lastQuery = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      lastQuery.current = null;
      return;
    }
    if (lastQuery.current !== query) {
      const opening = lastQuery.current === null;
      lastQuery.current = query;
      if (query === "" || opening) {
        rest();
        return;
      }
      const first = rows.find((row) => !row.disabled) ?? null;
      setHighlightState(first?.id ?? null);
      report(first);
      return;
    }
    if (highlight !== null && !indexOf.has(highlight)) {
      setHighlightState(null);
      report(null);
    }
  }, [open, query, rows, indexOf, highlight, rest, report]);

  const highlightIndex =
    highlight === null ? -1 : (indexOf.get(highlight) ?? -1);

  useLayoutEffect(() => {
    if (!open || highlightIndex < 0) return;
    document
      .getElementById(optionId(highlightIndex))
      ?.scrollIntoView?.({ block: "nearest" });
  });

  const step = (from: number, by: 1 | -1): R | undefined => {
    for (let i = from + by; i >= 0 && i < rows.length; i += by) {
      const row = rows[i] as R;
      if (!row.disabled) return row;
    }
    return undefined;
  };

  const choose = (row: R) => {
    if (row.disabled) return;
    onSelect(row);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    let next: R | undefined;
    switch (event.key) {
      case "ArrowDown":
        next = step(highlightIndex < 0 ? -1 : highlightIndex, 1);
        break;
      case "ArrowUp":
        next = step(highlightIndex < 0 ? rows.length : highlightIndex, -1);
        break;
      case "Home":
        next = step(-1, 1);
        break;
      case "End":
        next = step(rows.length, -1);
        break;
      case "Enter": {
        event.preventDefault();
        const row = highlightIndex < 0 ? undefined : rows[highlightIndex];
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
    if (next) move(next);
  };

  let flatIndex = 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild ref={trigger}>
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
              highlightIndex < 0 ? undefined : optionId(highlightIndex)
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
          id={listId}
          role="listbox"
          aria-label={listLabel}
          className="min-h-0 flex-1 overflow-y-auto p-1"
          // Pressing a row would otherwise move focus out of the box.
          onMouseDown={(event) => event.preventDefault()}
          onPointerLeave={() => {
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
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: the filter box takes the keys; focus never comes here
                <div
                  key={row.id}
                  id={optionId(index)}
                  role="option"
                  tabIndex={-1}
                  aria-selected={highlighted}
                  aria-disabled={row.disabled || undefined}
                  data-highlighted={highlighted ? "" : undefined}
                  data-selected={selected ? "" : undefined}
                  data-disabled={row.disabled ? "" : undefined}
                  className="relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                  onPointerMove={() => {
                    if (!row.disabled && !highlighted) move(row);
                  }}
                  onClick={() => choose(row)}
                >
                  {renderRow(row, { highlighted, selected })}
                  {selected && (
                    <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                      <CheckIcon aria-hidden />
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
      </PopoverContent>
    </Popover>
  );
}
