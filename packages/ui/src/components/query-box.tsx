import {
  type CompiledQuerySchema,
  type CompletionRow,
  orderRows,
  parseQuery,
  type SourceResult,
  type ValueProviders,
} from "@orz/query";
import { ClockIcon, FilterIcon, TagIcon, XIcon } from "lucide-react";
import type {
  ComponentProps,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";
import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useQueryCompletion } from "../hooks/use-query-completion.ts";
import type {
  QueryHistory,
  QueryHistoryEntry,
} from "../hooks/use-query-history.ts";
import { isPlainClick } from "../lib/link.ts";
import { cn } from "../lib/utils.ts";
import { buttonVariants } from "./button.tsx";
import { type CaretPosition, HighlightedInput } from "./highlighted-input.tsx";
import { highlightQuery } from "./query-highlight.tsx";

/**
 * What a row element wears, spread onto it whole. `onClick` takes the row the
 * way Enter would; an app that handles the click itself (a link, say)
 * replaces it.
 */
export type OptionProps = {
  id: string;
  role: "option";
  tabIndex: -1;
  "aria-selected": boolean;
  className: string;
  onMouseMove: () => void;
  onClick: () => void;
};

/** Rows the app adds to the panel: jumps, anything that is not syntax or history. */
export type RowSource<R> = {
  id: string;
  /** Whether the caret is on something this source recognises; see `orderRows`. */
  matched: boolean;
  /** Takes only what the other sources left. */
  yields?: boolean;
  rows: readonly R[];
  key: (row: R) => string;
  render: (row: R, option: OptionProps) => ReactNode;
  /** Tab takes it and keeps editing. */
  apply?: (row: R) => { value: string; caret: number } | null;
  /** Shift+Delete on the highlighted row. */
  remove?: (row: R) => void;
};

type BoxRow<R> =
  | { kind: "submit" }
  | { kind: "completion"; row: CompletionRow }
  | { kind: "app"; source: RowSource<R>; row: R }
  | { kind: "history"; entry: QueryHistoryEntry };

/**
 * `w-full` because a `<button>` row resolves `width: auto` to fit-content and
 * would otherwise shrink to a pill beside its full-width neighbours; on the
 * `<a>` and `<div>` rows, which are block already, it changes nothing.
 */
const OPTION =
  "flex w-full items-center gap-2 rounded-item px-2 py-1.5 text-ui min-h-row touch:min-h-touch raymond:py-0.5 raymond:touch:py-1.5";

/** Nothing highlighted. Enter then submits what was typed, not an offer. */
const NONE = -1;

/** Also the React key; the highlight follows it, not an index. */
function rowKey<R>(row: BoxRow<R>): string {
  if (row.kind === "submit") return "submit";
  if (row.kind === "app") return `${row.source.id}:${row.source.key(row.row)}`;
  if (row.kind === "history") return `history:${row.entry.q}`;
  return `completion:${row.row.id}`;
}

/**
 * Past queries in two bands: those the box's value begins, and those it is
 * only part of; the one it equals is in neither, as taking it would change
 * nothing. Matched against the whole value, not the word at the caret: a past
 * query is a whole search, not the end of a word. Both bands yield, so they
 * take only the room the other rows leave, and the first counts as matched,
 * which puts it above the submit row.
 */
function historyResults<R>(
  entries: readonly QueryHistoryEntry[],
  value: string,
): SourceResult<BoxRow<R>>[] {
  const needle = value.trim().toLowerCase();
  const prefix: BoxRow<R>[] = [];
  const within: BoxRow<R>[] = [];
  for (const entry of entries) {
    const q = entry.q.toLowerCase();
    if (q === needle) continue;
    if (q.startsWith(needle)) prefix.push({ kind: "history", entry });
    else if (q.includes(needle)) within.push({ kind: "history", entry });
  }
  return [
    { matched: true, yields: true, rows: prefix },
    { matched: false, yields: true, rows: within },
  ];
}

/**
 * One glyph per kind of offer. A row is a short run of monospace and a few
 * grey words, so the icon carries the whole distinction between a key and a
 * value.
 */
const COMPLETION_ICON = {
  key: FilterIcon,
  value: TagIcon,
} satisfies Record<CompletionRow["icon"], typeof FilterIcon>;

/**
 * A ghost icon button's look, but no button: a second action inside the
 * option, as a FilterMenu row's submenu half is. An option's children are
 * presentational, so a real button there would be read as nothing and nest
 * one control in another; the keyboard's way is Shift+Delete. `-my-1` keeps
 * the row its pointer height, as InfoPopover's button keeps a label's line.
 * A pointer that can hover brings it up on the highlighted row, which moving
 * onto a row makes it; with nothing to hover (touch, some styluses) it stays
 * on every row, or it could never be reached. Not `transition-all`, which
 * would keep it on a row the highlight has left for the length of a fade.
 * Under raymond the highlight's fill shows through it, and only its bevel
 * rises under the pointer.
 */
const REMOVE = cn(
  buttonVariants({
    variant: "ghost",
    size: "icon-xs",
    className:
      "-my-1 text-muted-foreground transition-[color,background-color,box-shadow] hover:text-foreground can-hover:invisible can-hover:group-hover/option:visible can-hover:group-aria-selected/option:visible raymond:hover:bg-transparent",
  }),
);

/** A past query, in the schema's colours, with its × to forget it. */
function HistoryRow({
  entry,
  option,
  href,
  schema,
  providers,
  onChoose,
  onRemove,
}: {
  entry: QueryHistoryEntry;
  option: OptionProps;
  href: string | undefined;
  schema: CompiledQuerySchema;
  providers: ValueProviders;
  onChoose: () => void;
  onRemove: () => void;
}) {
  const props = {
    ...option,
    className: cn(option.className, "group/option"),
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (href !== undefined) {
        // A modified or middle click is the browser's: a new tab, a window.
        if (!isPlainClick(event)) return;
        event.preventDefault();
      }
      onChoose();
    },
  };
  const content = (
    <>
      <ClockIcon
        className="size-3.5 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">
        {highlightQuery(
          entry.q,
          parseQuery(schema, entry.q),
          schema,
          providers,
        )}
      </span>
      <span
        aria-hidden
        data-slot="query-history-remove"
        className={REMOVE}
        // Kept from the row, whose click would submit the query, and from a
        // link row's default, which would go there or open a tab.
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          onRemove();
        }}
        onAuxClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
      >
        <XIcon />
      </span>
    </>
  );
  return href === undefined ? (
    <div {...props}>{content}</div>
  ) : (
    <a {...props} href={href}>
      {content}
    </a>
  );
}

/**
 * A query box: `HighlightedInput` with the schema's colours, its completions,
 * and the app's own rows in one panel, behind todou's keyboard model.
 *
 * Enter submits it the way every search box on the web does, and where the
 * query goes is the app's: `onSubmit`. It is no `<form>` of its own, so it can
 * sit in one as a field; Enter never reaches the enclosing form, whose
 * submitting is `onSubmit`'s to decide.
 *
 * The listbox is hand-rolled rather than a radix popover because focus has to
 * stay in the input and `Content` wants to take it. Nothing is ever
 * preselected: the reader is typing a query, so Enter belongs to the query
 * unless they arrowed onto something else. Tab is the key that takes an offer.
 *
 * Given a `history`, the panel offers past queries after everything else:
 * those the value begins above the submit row, those it is only part of
 * below it. Tab loads one into the box, Enter or a click submits it, and
 * Shift+Delete or its × forgets it. The box records nothing itself; the app
 * records a query in `onSubmit`, where it knows a search really ran.
 */
export function QueryBox<R>({
  schema,
  providers,
  value,
  onValueChange,
  onSubmit,
  sources = [],
  history,
  queryHref,
  renderSubmitRow,
  limit = 20,
  onEscape,
  onOpenChange,
  listAlign = "centered",
  leading,
  inputProps = {},
  className,
  panelClassName,
}: {
  schema: CompiledQuerySchema;
  providers: ValueProviders;
  value: string;
  onValueChange: (value: string) => void;
  /**
   * Enter with nothing highlighted, or on the submit row; `chosen` when an app row was
   * highlighted; `fromHistory` when a history row was, its query then being submitted as it
   * was searched before.
   */
  onSubmit: (
    query: string,
    chosen: R | undefined,
    fromHistory: boolean,
  ) => void;
  sources?: readonly RowSource<R>[];
  /** Past queries offered in the panel: `useQueryHistory`'s, or any with the same shape. */
  history?: Pick<QueryHistory, "entries" | "remove">;
  /** The address of a query's results; given, each history row is a link there. */
  queryHref?: (query: string) => string;
  /** The row that submits the query as typed, always present. */
  renderSubmitRow: (query: string, option: OptionProps) => ReactNode;
  /** Rows offered at most, the submit row not counted. */
  limit?: number;
  /**
   * Escape arriving with no panel left to close. The first press is the
   * box's own; where the second one goes is the app's to decide.
   */
  onEscape?: () => void;
  /** The panel opened or closed; how an app defers loading its value lists. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Where the panel grows from: `centered` about the box, for a box that
   * sits in the middle of its row; `start` from the box's left edge, for one
   * that starts at the edge of the screen.
   */
  listAlign?: "centered" | "start";
  /** Drawn at the input's left edge, inside its border: a search icon. */
  leading?: ReactNode;
  inputProps?: Omit<ComponentProps<"input">, "value" | "onChange">;
  className?: string;
  panelClassName?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // A key, so a search answer that lands rows above it does not move it.
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [position, setPosition] = useState<CaretPosition>({ caret: 0 });

  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();

  const { parts, completions, loading } = useQueryCompletion({
    schema,
    value,
    caret: position.caret,
    providers,
    enabled: focused && !dismissed,
  });

  const results: SourceResult<BoxRow<R>>[] = [
    // App sources first: a row the app recognises (a jump to what the query
    // names) outranks finishing a word, as in todou.
    ...sources.map((source) => ({
      matched: source.matched,
      ...(source.yields === undefined ? {} : { yields: source.yields }),
      rows: source.rows.map((row): BoxRow<R> => ({ kind: "app", source, row })),
    })),
    ...completions.map((result) => ({
      matched: result.matched,
      rows: result.rows.map((row): BoxRow<R> => ({ kind: "completion", row })),
    })),
    ...(history === undefined ? [] : historyResults<R>(history.entries, value)),
  ];
  const rows = orderRows<BoxRow<R>>(results, { kind: "submit" }, limit);
  const query = value.trim();
  const open = focused && !dismissed && (query !== "" || rows.length > 1);
  const hl =
    highlightKey === null
      ? NONE
      : rows.findIndex((row) => rowKey(row) === highlightKey);
  const setHighlight = (idx: number) => {
    const row = idx === NONE ? undefined : rows[idx];
    setHighlightKey(row === undefined ? null : rowKey(row));
  };

  // A value the app set (a submitted row loaded into the box, say) is a new
  // query, and nothing in it is aimed at yet.
  const emitted = useRef(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    if (value !== emitted.current) setHighlightKey(null);
  }
  const emit = (next: string) => {
    emitted.current = next;
    onValueChange(next);
  };
  const optionId = (idx: number) => `${listId}-${idx}`;

  // Reported on change only, so an app can tie loading to it without being
  // told the same thing on every keystroke.
  const reportOpen = useRef(onOpenChange);
  reportOpen.current = onOpenChange;
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current === open) return;
    wasOpen.current = open;
    reportOpen.current?.(open);
  }, [open]);

  // Ten rows already keep the panel short in an ordinary window; this is the
  // floor under a short one, where even a few rows reach past the bottom.
  // Measured rather than a `calc(100vh - …)`, because the same box can sit
  // anywhere on the page and the height above it is not a constant. Before
  // paint, or there is a frame of the too-tall panel.
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure whenever the panel opens or changes length
  useLayoutEffect(() => {
    const panel = list.current;
    if (panel === null) {
      setMaxHeight(undefined);
      return;
    }
    const measure = () => {
      setMaxHeight(window.innerHeight - panel.getBoundingClientRect().top - 8);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, rows.length]);

  // A scroll container can hold the highlight out of sight, and then the
  // arrow keys are moving something the reader cannot see. The rows are the
  // panel's only children, so the index is the child.
  useLayoutEffect(() => {
    if (hl === NONE) return;
    list.current?.children[hl]?.scrollIntoView?.({ block: "nearest" });
  }, [hl]);

  /**
   * Accepting an offer rewrites the query; the caret goes where it says once
   * the new value is in the input. The value is the app's state, so that is
   * a later commit than this one.
   */
  const pending = useRef<{ value: string; caret: number } | null>(null);
  const accept = (apply: { value: string; caret: number }) => {
    emit(apply.value);
    setHighlight(NONE);
    setDismissed(false);
    pending.current = apply;
  };
  useLayoutEffect(() => {
    const apply = pending.current;
    const el = input.current;
    if (apply === null || el === null || el.value !== apply.value) return;
    pending.current = null;
    el.focus();
    el.setSelectionRange(apply.caret, apply.caret);
    setPosition({ caret: apply.caret });
  });

  /**
   * What Tab takes — the submit row is not an offer.
   *
   * A highlighted past query, or app row with `apply`, loads what it says
   * into the box, which is what Tab already means: take the offer and keep
   * editing. With nothing highlighted Tab still falls back to the first
   * *completion* and never to either — an unaimed Tab means "finish the word
   * I am typing", and a whole past query is a long way from that.
   *
   * Only a completion above the submit row counts, one the typed word really
   * matches. The key table under an empty word is there to be read; taking
   * it unaimed turned a held Tab into `is:open is:open …` forever and left
   * the box a focus trap. Without a match Tab moves focus on.
   */
  const acceptable = (
    from: number,
  ): { value: string; caret: number } | null => {
    const at = rows[from];
    if (at?.kind === "completion") return at.row.apply;
    if (at?.kind === "history")
      return { value: at.entry.q, caret: at.entry.q.length };
    if (at?.kind === "app") {
      const apply = at.source.apply?.(at.row);
      if (apply != null) return apply;
    }
    for (const row of rows) {
      if (row.kind === "submit") return null;
      if (row.kind === "completion") return row.row.apply;
    }
    return null;
  };

  /** Enter on `chosen`, or on nothing. */
  const choose = (chosen: BoxRow<R> | undefined) => {
    // Enter on a completion takes it and stays put; the reader is still
    // building the query, not asking for it.
    if (chosen?.kind === "completion") {
      accept(chosen.row.apply);
      return;
    }
    // An empty box has nothing to submit — unless a row is what is being
    // submitted, a past query say.
    if (query === "" && chosen?.kind !== "app" && chosen?.kind !== "history")
      return;
    // A past query is submitted as it was searched, in place of the value.
    const submitted = chosen?.kind === "history" ? chosen.entry.q : query;
    if (chosen?.kind === "history") emit(submitted);
    setDismissed(true);
    setHighlight(NONE);
    onSubmit(
      submitted,
      chosen?.kind === "app" ? chosen.row : undefined,
      chosen?.kind === "history",
    );
  };

  /** Forgets a past query, or an app row that can be removed. */
  const removeRow = (row: BoxRow<R> | undefined): boolean => {
    if (row?.kind === "history" && history !== undefined) {
      history.remove(row.entry.q);
      return true;
    }
    if (row?.kind === "app" && row.source.remove !== undefined) {
      row.source.remove(row.row);
      return true;
    }
    return false;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    inputProps.onKeyDown?.(e);
    if (e.defaultPrevented) return;
    // An IME takes Enter to commit its candidate, and on some browsers the
    // keydown arrives with the composition already ended; keyCode 229 is how
    // that one still says so.
    const composing = e.nativeEvent.isComposing || e.keyCode === 229;
    if (e.key === "Enter") {
      // Implicit submission would otherwise send an enclosing form along with
      // this Enter, the IME's included.
      if (!e.nativeEvent.isComposing) e.preventDefault();
      // Esc hid the panel, and hiding it has to mean something: Enter then
      // does the plain thing rather than following an invisible highlight.
      // `open` is false after Escape, so nothing counts as chosen.
      if (!composing) choose(open && hl !== NONE ? rows[hl] : undefined);
      return;
    }
    // The IME owns every key until it commits: Escape cancels its candidate,
    // Tab and the arrows pick one.
    if (composing) return;
    if (e.key === "Escape") {
      // The first press closes the panel and stays the box's own; only with
      // nothing left to close is Escape the app's (leaving an overlay, say).
      if (!open) {
        onEscape?.();
        return;
      }
      setDismissed(true);
      setHighlight(NONE);
    } else if (e.key === "Tab" && open && !e.shiftKey) {
      // Never falls through to the submit row or an app row without
      // `apply`: with nothing to take, Tab moves focus as it always does.
      const apply = acceptable(hl);
      if (apply === null) return;
      accept(apply);
    } else if (!open) {
      return;
    } else if (e.key === "Delete" && e.shiftKey) {
      // The address bar's own gesture for the same thing. macOS has no
      // Delete key of its own; a button on the row is the path there.
      // The highlight moves to the row taking this one's place, so a run of
      // them goes without arrowing back onto each.
      const next = rows[hl + 1] ?? rows[hl - 1];
      if (!removeRow(rows[hl])) return;
      setHighlightKey(next === undefined ? null : rowKey(next));
    } else if (e.key === "ArrowDown") {
      setHighlight(Math.min(hl + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      // Back past the first row is back to nothing selected, which is where
      // the box started and what Enter means by default.
      setHighlight(Math.max(hl - 1, NONE));
    } else if (e.key === "Home") {
      // While the panel is open the keys walk it, as in any listbox; with
      // it closed they move the caret as usual.
      setHighlight(0);
    } else if (e.key === "End") {
      setHighlight(rows.length - 1);
    } else {
      return;
    }
    e.preventDefault();
  };

  const optionProps = (idx: number): OptionProps => ({
    id: optionId(idx),
    role: "option",
    // Focus never leaves the input; aria-activedescendant does the walking.
    tabIndex: -1,
    "aria-selected": idx === hl,
    className: cn(
      OPTION,
      idx === hl &&
        "bg-accent text-accent-foreground state-cue raymond:bg-primary raymond:text-primary-foreground raymond:[--foreground:var(--primary-foreground)] raymond:[--muted-foreground:var(--primary-foreground)]",
    ),
    onMouseMove: () => setHighlight(idx),
    onClick: () => choose(rows[idx]),
  });

  return (
    <search className={cn("relative", className)}>
      {leading !== undefined && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2 z-10 flex -translate-y-1/2 text-muted-foreground [&_svg]:size-3.5"
        >
          {leading}
        </span>
      )}
      <HighlightedInput
        type="text"
        // The phone keyboard's Enter key reads Search, as a search box's
        // should.
        enterKeyHint="search"
        {...inputProps}
        inputRef={input}
        // The browser's own drop-down would cover this panel, and it knows
        // neither the syntax nor the app's values (T-268); past queries come
        // from `history` instead.
        autoComplete="off"
        // A combobox, so a screen reader follows `aria-activedescendant`
        // through the rows while focus stays here with the caret.
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && hl !== NONE ? optionId(hl) : undefined}
        aria-autocomplete="list"
        aria-busy={loading || undefined}
        value={value}
        onValueChange={(next) => {
          emit(next);
          setDismissed(false);
          setHighlight(NONE);
        }}
        onCaretChange={setPosition}
        render={(text) =>
          highlightQuery(
            text,
            text === value ? parts : parseQuery(schema, text),
            schema,
            providers,
          )
        }
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          setFocused(true);
          setDismissed(false);
          setHighlight(NONE);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          inputProps.onBlur?.(e);
          // Clicking a row blurs the input before the click lands; the
          // listbox's own mousedown guard covers the pointer, this covers
          // a focus that really did move into it.
          if (list.current?.contains(e.relatedTarget)) return;
          setFocused(false);
        }}
        {...(leading === undefined ? {} : { padding: "pl-7" })}
      />
      {open && (
        <div
          ref={list}
          id={listId}
          role="listbox"
          aria-label="Suggestions"
          // Without this, pressing on a row blurs the input first and the
          // listbox is gone before the click arrives.
          onMouseDown={(e) => e.preventDefault()}
          style={{ maxHeight }}
          className={cn(
            // Under raymond the suggestions drop from the field as a combo
            // box's list does: flush under it, on the window colour, in a
            // one-pixel black frame, the highlighted row in the highlight.
            "absolute top-full z-50 mt-1 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-overlay border bg-popover p-1 shadow-overlay raymond:mt-0 raymond:border-(--3d-dark-shadow) raymond:bg-(--window) raymond:p-0 raymond:shadow-none",
            listAlign === "start"
              ? // The box starts at the edge of the screen, so the panel
                // takes its width and stops. A floor still applies, because
                // the narrowest phone squeezes the box down to ~250px and a
                // row has to survive — but the floor stops at the viewport,
                // since a `min-width` beats a `max-width` and a flat 20rem
                // would push the page 16px wider at 320.
                "left-0 w-full min-w-[min(20rem,calc(100vw-2rem))]"
              : // Centred on the box, not on the caret: the panel following
                // the caret across the line made the reader chase it (T-268).
                "left-1/2 w-[28rem] -translate-x-1/2",
            panelClassName,
          )}
        >
          {rows.map((row, idx) => {
            const option = optionProps(idx);
            if (row.kind === "submit") {
              return (
                <Fragment key={rowKey(row)}>
                  {renderSubmitRow(query, option)}
                </Fragment>
              );
            }
            if (row.kind === "app") {
              return (
                <Fragment key={rowKey(row)}>
                  {row.source.render(row.row, option)}
                </Fragment>
              );
            }
            if (row.kind === "history") {
              return (
                <HistoryRow
                  key={rowKey(row)}
                  entry={row.entry}
                  option={option}
                  href={queryHref?.(row.entry.q)}
                  schema={schema}
                  providers={providers}
                  onChoose={() => choose(row)}
                  onRemove={() => {
                    removeRow(row);
                    // Unlike Shift+Delete, nothing is highlighted after: the
                    // pointer is where it was, and on touch the tap had
                    // highlighted this row, so a highlight passed on would
                    // make the keyboard's Search key submit the next query
                    // rather than what was typed.
                    setHighlight(NONE);
                  }}
                />
              );
            }
            const Icon = COMPLETION_ICON[row.row.icon];
            return (
              // A button, not a link: it goes nowhere, it rewrites the query
              // in place. Focus stays in the input regardless — the listbox
              // cancels the mousedown that would move it.
              <button
                type="button"
                key={rowKey(row)}
                {...option}
                onClick={() => accept(row.row.apply)}
              >
                <Icon
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="truncate font-mono text-ui-sm">
                  {row.row.text}
                </span>
                {row.row.hint !== undefined && (
                  <span className="truncate text-muted-foreground text-ui-sm">
                    {row.row.hint}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </search>
  );
}
