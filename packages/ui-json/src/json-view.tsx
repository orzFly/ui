// Ported from PicoTera (BSD-3-Clause); see NOTICE.
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@orz/ui/components/dropdown-menu";
import { Input } from "@orz/ui/components/input";
import { Pane } from "@orz/ui/components/pane";
import { ToolbarButton } from "@orz/ui/components/toolbar";
import { copyToClipboard, writeClipboard } from "@orz/ui/lib/clipboard";
import { cn } from "@orz/ui/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  BracesIcon,
  CheckIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  CodeIcon,
  CopyIcon,
  KeyRoundIcon,
  ListChecksIcon,
  Maximize2Icon,
  RouteIcon,
  SearchIcon,
  WrapTextIcon,
} from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useControllable } from "./controllable.ts";
import { InspectDialog, type InspectTarget } from "./inspect-dialog.tsx";
import { FILL_CLASS, indentOf, JsonRowView, TICK_CLASS } from "./json-row.tsx";
import { DEFAULT_LABELS, type JsonViewLabels } from "./labels.ts";
import {
  anchorOf,
  extendVertical,
  focusOf,
  hasKey,
  indexRows,
  isInside,
  isNodeRow,
  liftMembers,
  membersOf,
  moveLeft,
  moveRight,
  moveToEnd,
  moveVertical,
  type SelectionGeometry,
  sameSelection,
  selectAll,
  selectionAfterCollapse,
  selectionExists,
  selectionRows,
  selectionSource,
  selectionTextOf,
} from "./selection.ts";
import {
  ancestorsOf,
  collectExpandable,
  flatten,
  type JsonNodeRow,
  type JsonRow,
  PREVIEW_LIMIT,
  prettyJsonOf,
  ROW_BUDGET,
  resolvePath,
  searchPaths,
  WRAP_PREVIEW_LIMIT,
} from "./tree.ts";
import type { JsonDocument, JsonSelection, JsonSummary } from "./types.ts";
import { WarningStrip } from "./warning-strip.tsx";

export type JsonViewProps = (
  | { value: unknown; document?: never }
  | { document: JsonDocument; value?: never }
) & {
  /** A collapsed non-empty object's one-line summary. Default: none, the row reads `{…}`. */
  summary?: (record: Record<string, unknown>) => JsonSummary | null;

  /** The selection, controlled; `null` for none. */
  selection?: JsonSelection | null;
  defaultSelection?: JsonSelection | null;
  onSelectionChange?: (selection: JsonSelection | null) => void;

  /** Soft wrap: strings wrap and previews cut at 1000 characters, not 160. */
  wrap?: boolean;
  defaultWrap?: boolean;
  onWrapChange?: (wrap: boolean) => void;

  /** Take the parent's height. Without it the view grows to its rows, up to `maxHeight`. */
  fill?: boolean;
  /** px; default 480. Ignored with `fill`. */
  maxHeight?: number;
  /** The toolbar's Inspect document button. Default true; the dialog's nested view sets false. */
  inspectRoot?: boolean;

  /** Every visible and announced string; English by default. */
  labels?: Partial<JsonViewLabels>;
  className?: string;
};

/** How long typing rests before the full-depth search runs. */
const SEARCH_DEBOUNCE_MS = 180;
const COPIED_MS = 1500;
/** The band along the scroller's edges where a drag scrolls it, and its top speed per frame. */
const EDGE_PX = 40;
const EDGE_SPEED = 18;
const ROW_BUDGET_TEXT = ROW_BUDGET.toLocaleString("en");

/**
 * A JSON value as a windowed tree: one row per visible node, so a collapsed container costs one
 * row however large it is. Keys, values and ranges of members are selected as tokens and copied
 * as JSON; a parsed `document` adds its comments and Copy source.
 */
export function JsonView(props: JsonViewProps) {
  const {
    wrap: wrapProp,
    defaultWrap = false,
    onWrapChange,
    document: documentProp,
    value,
  } = props;
  const [wrap, setWrap] = useControllable(
    wrapProp,
    defaultWrap,
    onWrapChange,
    Object.is,
  );
  const document = useMemo<JsonDocument>(
    () => documentProp ?? { value },
    [documentProp, value],
  );
  // A new value or document, by reference, starts the view over: expansion, search, warnings
  // and an uncontrolled selection. Wrap is the reader's and stays.
  const input = documentProp ?? value;
  const [generation, setGeneration] = useState({ input, key: 0 });
  if (!Object.is(generation.input, input)) {
    setGeneration({ input, key: generation.key + 1 });
  }
  return (
    <JsonViewBody
      key={generation.key}
      {...props}
      document={document}
      wrap={wrap}
      setWrap={setWrap}
    />
  );
}

type BodyProps = Omit<JsonViewProps, "value" | "document" | "wrap"> & {
  document: JsonDocument;
  wrap: boolean;
  setWrap: (wrap: boolean) => void;
};

/** Where on a row a press landed. */
type Part = "key" | "value" | "gutter";

function partOf(target: Element, row: HTMLElement): Part {
  const part = target.closest<HTMLElement>("[data-part]");
  if (!part || !row.contains(part)) return "value";
  return part.dataset.part as Part;
}

function useRowHeight(probe: React.RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(22);
  useLayoutEffect(() => {
    const el = probe.current;
    if (!el) return;
    const read = () => {
      const measured = el.getBoundingClientRect().height;
      if (measured > 0) setHeight(measured);
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [probe]);
  return height;
}

function JsonViewBody({
  document,
  summary,
  selection: selectionProp,
  defaultSelection,
  onSelectionChange,
  wrap,
  setWrap,
  fill = false,
  maxHeight = 480,
  inspectRoot = true,
  labels: labelsProp,
  className,
}: BodyProps) {
  const labels = useMemo(
    () => ({ ...DEFAULT_LABELS, ...labelsProp }),
    [labelsProp],
  );
  const { value, facts } = document;
  const baseId = useId();

  // --- state ------------------------------------------------------------------

  // A mutable set behind a version counter: the walk reads it once per row, and copying it on
  // every toggle would cost a pass over every open path.
  const expanded = useRef(new Set<string>());
  const [expandedVersion, setExpandedVersion] = useState(0);
  const bumpExpanded = () => setExpandedVersion((n) => n + 1);
  const [expandLimited, setExpandLimited] = useState(false);
  const [warnDismissed, setWarnDismissed] = useState(false);

  const [selection, setSelectionRaw, selectionRef] = useControllable(
    selectionProp,
    defaultSelection ?? null,
    onSelectionChange,
    sameSelection,
  );
  // The row the keyboard and the ⋯ button follow, kept when the selection is cleared.
  const [restFocus, setRestFocus] = useState<string | null>(null);
  const focusPath = selection ? focusOf(selection) : restFocus;
  const setSelection = useCallback(
    (next: JsonSelection | null) => {
      const previous = selectionRef.current;
      if (!next && previous) setRestFocus(focusOf(previous));
      setSelectionRaw(next);
    },
    [setSelectionRaw, selectionRef],
  );

  // A selection that names nothing in the value is dropped.
  useEffect(() => {
    if (selection && !selectionExists(value, selection)) setSelectionRaw(null);
  }, [selection, value, setSelectionRaw]);

  // --- search -----------------------------------------------------------------

  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(
      () => setQuery(queryInput.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [queryInput]);
  const search = useMemo(
    () => (query ? searchPaths(value, query, { facts }) : null),
    [value, query, facts],
  );
  const needle = query.toLowerCase();
  const clearSearch = () => {
    setQueryInput("");
    setQuery("");
  };

  // --- rows -------------------------------------------------------------------

  // biome-ignore lint/correctness/useExhaustiveDependencies: expandedVersion stands for the mutable set
  const result = useMemo(
    () =>
      flatten(value, {
        expanded: expanded.current,
        visible: search ? search.visible : null,
        previewLimit: wrap ? WRAP_PREVIEW_LIMIT : PREVIEW_LIMIT,
        facts,
        summary,
        items: labels.items,
      }),
    [value, expandedVersion, search, wrap, facts, summary, labels.items],
  );
  const rows = result.rows;
  const index = useMemo(() => indexRows(rows), [rows]);
  const geometry = useMemo(
    () => selectionRows(rows, selection),
    [rows, selection],
  );

  // --- virtualization ---------------------------------------------------------

  const scroller = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const rowHeight = useRowHeight(probe);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    getItemKey: (i) => rows[i]?.path ?? i,
    estimateSize: () => rowHeight,
    overscan: 8,
    initialRect: { width: 0, height: fill ? 0 : maxHeight },
  });
  // Measurements taken in one mode, or at one row height, are wrong in the other.
  // biome-ignore lint/correctness/useExhaustiveDependencies: wrap and rowHeight are what invalidate them
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [wrap, rowHeight, virtualizer]);

  const scrollToPath = useCallback(
    (path: string | null) => {
      if (path === null) return;
      const at = index.get(path);
      if (at !== undefined) virtualizer.scrollToIndex(at, { align: "auto" });
    },
    [index, virtualizer],
  );

  // --- expansion --------------------------------------------------------------

  const collapse = (path: string) => {
    const set = expanded.current;
    for (const p of set) {
      if (p === path || isInside(p, path)) set.delete(p);
    }
    setSelection(selectionAfterCollapse(selectionRef.current, path));
  };

  const toggle = (row: JsonNodeRow) => {
    if (!row.expandable) return;
    if (expanded.current.has(row.path)) {
      expanded.current.delete(row.path);
      setSelection(selectionAfterCollapse(selectionRef.current, row.path));
    } else {
      expanded.current.add(row.path);
    }
    bumpExpanded();
  };

  const setSubtree = (path: string, open: boolean) => {
    const found = resolvePath(value, path);
    if (!found.found) return;
    if (open) {
      const { paths, limited } = collectExpandable(
        found.value,
        path,
        ROW_BUDGET,
      );
      for (const p of paths) expanded.current.add(p);
      if (limited) {
        setExpandLimited(true);
        setWarnDismissed(false);
      }
    } else {
      collapse(path);
    }
    bumpExpanded();
  };

  const expandAll = () => {
    const { paths, limited } = collectExpandable(value, "$", ROW_BUDGET);
    expanded.current = new Set(paths);
    setExpandLimited(limited);
    if (limited) setWarnDismissed(false);
    bumpExpanded();
  };

  const collapseAll = () => {
    expanded.current = new Set();
    const current = selectionRef.current;
    if (current) {
      // Only the top level is left on rows: a selection below it moves to its top-level member.
      const top = (path: string) => ancestorsOf(path)[1] ?? path;
      const anchor = top(anchorOf(current));
      if (
        anchor !== anchorOf(current) ||
        top(focusOf(current)) !== focusOf(current)
      ) {
        setSelection({ type: "members", anchor, focus: anchor });
      }
    }
    bumpExpanded();
  };

  // --- copy -------------------------------------------------------------------

  const singlePath = (s: JsonSelection | null): string | null => {
    if (!s) return null;
    if (s.type !== "members") return s.path;
    return s.anchor === s.focus ? s.anchor : null;
  };

  const memberCount = (s: JsonSelection): number => {
    if (s.type !== "members") return 1;
    return membersOf(value, s)?.members.length ?? 1;
  };

  const copySelection = async (compact: boolean) => {
    const current = selectionRef.current;
    if (!current) return;
    const text = selectionTextOf(value, current, { compact });
    if (text === null) {
      toast.error(labels.cannotSerialise);
      return;
    }
    const count = memberCount(current);
    const said =
      compact && current.type !== "key"
        ? labels.copiedJson
        : current.type === "key"
          ? labels.copiedKey
          : count > 1
            ? labels.copiedMembers(count)
            : labels.copiedValue;
    await copyToClipboard(text, said);
  };

  const copyAsJson = async () => {
    const current = selectionRef.current;
    const path = singlePath(current);
    if (!current || path === null) return;
    const found = resolvePath(value, path);
    if (!found.found) return;
    const text =
      current.type === "key"
        ? JSON.stringify(String(found.key))
        : prettyJsonOf(found.value, 2);
    if (text === null) {
      toast.error(labels.cannotSerialise);
      return;
    }
    await copyToClipboard(text, labels.copiedJson);
  };

  const [copiedDocument, setCopiedDocument] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  const copyDocument = async () => {
    const pretty = prettyJsonOf(value, 2);
    if (pretty === null) {
      toast.error(labels.cannotSerialise);
      return;
    }
    if (!(await writeClipboard(pretty))) return;
    clearTimeout(copiedTimer.current);
    setCopiedDocument(true);
    copiedTimer.current = setTimeout(() => setCopiedDocument(false), COPIED_MS);
  };

  // --- inspect ----------------------------------------------------------------

  const [inspect, setInspect] = useState<InspectTarget | null>(null);
  const openInspect = (path: string | null) => {
    if (path === null) return;
    const found = resolvePath(value, path);
    if (found.found) setInspect({ value: found.value, path });
  };

  // --- menu -------------------------------------------------------------------

  const [menuPath, setMenuPath] = useState<string | null>(null);
  // On touch, Select members… makes each later tap extend a range from this anchor.
  const [touchAnchor, setTouchAnchor] = useState<string | null>(null);

  const covered = (rowIndex: number) =>
    geometry !== null &&
    rowIndex >= geometry.first &&
    rowIndex <= geometry.last;

  const menuItems = (): ReactNode => {
    const current = selectionRef.current;
    if (!current) return null;
    const single = singlePath(current);
    const count = memberCount(current);
    const at = single === null ? undefined : index.get(single);
    const row = at === undefined ? undefined : rows[at];
    const node = isNodeRow(row) ? row : undefined;
    const source =
      document.source !== undefined
        ? selectionSource(document, current)
        : undefined;
    const headerPath = single ?? focusOf(current);
    return (
      <>
        <DropdownMenuLabel className="truncate font-mono font-normal">
          {headerPath}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void copySelection(false)}>
          <CopyIcon />
          {count > 1 ? labels.copyMembers(count) : labels.copy}
          <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut>
        </DropdownMenuItem>
        {single !== null && (
          <DropdownMenuItem onSelect={() => void copyAsJson()}>
            <BracesIcon />
            {labels.copyAsJson}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => void copySelection(true)}>
          <BracesIcon />
          {labels.copyCompact}
          <DropdownMenuShortcut>Ctrl+Shift+C</DropdownMenuShortcut>
        </DropdownMenuItem>
        {source !== undefined && (
          <DropdownMenuItem
            onSelect={() => void copyToClipboard(source, labels.copiedSource)}
          >
            <CodeIcon />
            {labels.copySource}
          </DropdownMenuItem>
        )}
        {single !== null && (
          <DropdownMenuItem
            onSelect={() => void copyToClipboard(single, labels.copiedPath)}
          >
            <RouteIcon />
            {labels.copyPath}
          </DropdownMenuItem>
        )}
        {node && hasKey(node) && (
          <DropdownMenuItem
            onSelect={() =>
              void copyToClipboard(node.key as string, labels.copiedKey)
            }
          >
            <KeyRoundIcon />
            {labels.copyKey}
          </DropdownMenuItem>
        )}
        {single !== null && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openInspect(single)}>
              <Maximize2Icon />
              {labels.inspect}
              <DropdownMenuShortcut>Enter</DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        )}
        {node?.expandable && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setSubtree(node.path, true)}>
              <ChevronsUpDownIcon />
              {labels.expandSubtree}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSubtree(node.path, false)}>
              <ChevronsDownUpIcon />
              {labels.collapseSubtree}
            </DropdownMenuItem>
          </>
        )}
        {coarse && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                const from = focusOf(current);
                setTouchAnchor(from);
                setSelection({ type: "members", anchor: from, focus: from });
              }}
            >
              <ListChecksIcon />
              {labels.selectMembers}
            </DropdownMenuItem>
          </>
        )}
      </>
    );
  };

  // Whether the menu offers Select members…: only under a coarse pointer, where a drag scrolls.
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const forced = root.closest<HTMLElement>("[data-pointer]")?.dataset.pointer;
    if (forced) {
      setCoarse(forced === "coarse");
      return;
    }
    const query = window.matchMedia?.("(pointer: coarse)");
    if (!query) return;
    setCoarse(query.matches);
    const update = () => setCoarse(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const openMenuAt = (path: string) => {
    setMenuPath(path);
    scrollToPath(path);
  };

  // --- pointer ----------------------------------------------------------------

  const press = (row: JsonRow, part: Part, shift: boolean) => {
    const current = selectionRef.current;
    if (row.kind === "comment") {
      const member = row.member;
      setSelection(
        shift && current
          ? liftMembers(anchorOf(current), member)
          : { type: "members", anchor: member, focus: member },
      );
      return;
    }
    if (touchAnchor !== null) {
      setSelection(liftMembers(touchAnchor, row.path));
      return;
    }
    if (shift && current) {
      setSelection(liftMembers(anchorOf(current), row.path));
      return;
    }
    if (part === "key" && hasKey(row)) {
      setSelection({ type: "key", path: row.path });
    } else if (part === "gutter") {
      setSelection({ type: "members", anchor: row.path, focus: row.path });
    } else {
      setSelection({ type: "value", path: row.path });
    }
  };

  const drag = useRef<{
    anchor: string;
    last: string;
    pointerId: number;
    y: number;
    moved: boolean;
    frame?: number;
  } | null>(null);
  const lastPointer = useRef<string>("mouse");
  const suppressClick = useRef(false);

  const rowAt = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    if (target.closest("[data-slot=json-row-menu]")) return null;
    const el = target.closest<HTMLElement>("[data-row]");
    if (!el) return null;
    const row = rows[Number(el.dataset.index)];
    return row ? { el, row } : null;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    lastPointer.current = event.pointerType;
    suppressClick.current = false;
    if (event.button !== 0 || event.pointerType === "touch") return;
    const hit = rowAt(event.target);
    if (!hit) return;
    // The rows are select-none, so a press makes a token selection, never a text selection;
    // the press itself focuses the tree, the nearest focusable element, as a mouse focuses one.
    press(hit.row, partOf(event.target as Element, hit.el), event.shiftKey);
    const anchor = selectionRef.current
      ? anchorOf(selectionRef.current)
      : hit.row.path;
    drag.current = {
      anchor,
      last: hit.row.path,
      pointerId: event.pointerId,
      y: event.clientY,
      moved: false,
    };
  };

  const edgeScroll = () => {
    const session = drag.current;
    const el = scroller.current;
    if (!session || !el || session.frame !== undefined) return;
    const step = () => {
      const now = drag.current;
      if (!now) return;
      now.frame = undefined;
      const box = el.getBoundingClientRect();
      const speed = (distance: number) =>
        Math.ceil(((EDGE_PX - Math.max(0, distance)) / EDGE_PX) * EDGE_SPEED);
      const by =
        now.y < box.top + EDGE_PX
          ? -speed(now.y - box.top)
          : now.y > box.bottom - EDGE_PX
            ? speed(box.bottom - now.y)
            : 0;
      if (by === 0) return;
      el.scrollTop += by;
      extendTo(now.y);
      now.frame = requestAnimationFrame(step);
    };
    session.frame = requestAnimationFrame(step);
  };

  const extendTo = (y: number) => {
    const session = drag.current;
    const el = scroller.current;
    if (!session || !el) return;
    const box = el.getBoundingClientRect();
    const x = box.left + Math.min(box.width - 1, EDGE_PX);
    const clampedY = Math.min(box.bottom - 1, Math.max(box.top + 1, y));
    const under = el.ownerDocument.elementFromPoint?.(x, clampedY);
    const hit = rowAt(under ?? null);
    if (!hit) return;
    const path = hit.row.kind === "comment" ? hit.row.member : hit.row.path;
    if (path === session.last) return;
    session.last = path;
    if (!session.moved) {
      // Captured only once the drag leaves its row: a capture from the press would retarget
      // its click to the tree, and a press on a value would no longer open it.
      scroller.current?.setPointerCapture?.(session.pointerId);
    }
    session.moved = true;
    setSelection(liftMembers(session.anchor, path));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const session = drag.current;
    if (!session || session.pointerId !== event.pointerId) return;
    session.y = event.clientY;
    extendTo(event.clientY);
    edgeScroll();
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const session = drag.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (session.frame !== undefined) cancelAnimationFrame(session.frame);
    if (session.moved) suppressClick.current = true;
    drag.current = null;
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const hit = rowAt(event.target);
    if (!hit) return;
    const part = partOf(event.target as Element, hit.el);
    // A tap selects on release, so a swipe that scrolls selects nothing.
    if (lastPointer.current === "touch") {
      scroller.current?.focus({ preventScroll: true });
      press(hit.row, part, false);
    }
    if (hit.row.kind === "comment" || !hit.row.expandable) return;
    const onChevron = (event.target as Element).closest("[data-chevron]");
    if (onChevron && (event.ctrlKey || event.metaKey)) {
      setSubtree(hit.row.path, !hit.row.expanded);
      return;
    }
    // One click opens: a press on the value, or on the chevron, toggles the row.
    if (onChevron || (part === "value" && touchAnchor === null)) {
      toggle(hit.row);
    }
  };

  const onContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    const hit = rowAt(event.target);
    if (!hit) return;
    event.preventDefault();
    const at = Number(hit.el.dataset.index);
    if (!covered(at)) {
      press(hit.row, partOf(event.target as Element, hit.el), false);
    }
    const path = hit.row.kind === "comment" ? hit.row.member : hit.row.path;
    if (index.has(path)) openMenuAt(path);
  };

  // --- keyboard ---------------------------------------------------------------

  const searchInput = useRef<HTMLInputElement>(null);

  const moveTo = (next: JsonSelection | null) => {
    if (!next) return;
    setSelection(next);
    scrollToPath(focusOf(next));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Keys pressed in the tree, or on a row a tap focused; not those of the ⋯ button.
    const target = event.target as Element;
    if (target !== event.currentTarget && !target.matches("[data-row]")) return;
    const mod = event.ctrlKey || event.metaKey;
    const current = selectionRef.current;
    const focusAt = focusPath === null ? undefined : index.get(focusPath);
    const focusRow = focusAt === undefined ? undefined : rows[focusAt];
    const key = event.key;
    const handled = () => event.preventDefault();

    if (mod && (key === "c" || key === "C")) {
      if (!current) return;
      handled();
      void copySelection(event.shiftKey);
      return;
    }
    if (mod && (key === "a" || key === "A")) {
      handled();
      setSelection(selectAll());
      return;
    }
    if (mod && (key === "f" || key === "F")) {
      handled();
      searchInput.current?.focus();
      searchInput.current?.select();
      return;
    }
    if ((key === "F10" && event.shiftKey) || key === "ContextMenu") {
      if (focusPath === null || !index.has(focusPath)) return;
      handled();
      if (!current) setSelection({ type: "value", path: focusPath });
      openMenuAt(focusPath);
      return;
    }
    switch (key) {
      case "ArrowDown":
      case "ArrowUp": {
        handled();
        const delta = key === "ArrowDown" ? 1 : -1;
        const base =
          current ??
          (focusPath && index.has(focusPath)
            ? ({ type: "value", path: focusPath } as JsonSelection)
            : null);
        moveTo(
          event.shiftKey
            ? extendVertical(rows, base, delta)
            : current
              ? moveVertical(rows, current, delta)
              : base
                ? moveVertical(rows, base, delta)
                : moveVertical(rows, null, delta),
        );
        return;
      }
      case "ArrowRight": {
        if (!current) return;
        handled();
        if (
          current.type !== "key" &&
          isNodeRow(focusRow) &&
          focusRow.expandable &&
          !focusRow.expanded
        ) {
          toggle(focusRow);
          return;
        }
        moveTo(moveRight(rows, current));
        return;
      }
      case "ArrowLeft": {
        if (!current) return;
        handled();
        if (
          current.type !== "key" &&
          isNodeRow(focusRow) &&
          focusRow.expandable &&
          focusRow.expanded &&
          singlePath(current) === focusRow.path
        ) {
          toggle(focusRow);
          return;
        }
        moveTo(moveLeft(rows, current));
        return;
      }
      case "Home":
      case "End":
        handled();
        moveTo(moveToEnd(rows, current, key === "Home" ? "first" : "last"));
        return;
      case "Enter":
        if (focusPath === null) return;
        handled();
        openInspect(focusPath);
        return;
      case "Escape":
        if (!current && touchAnchor === null) return;
        handled();
        setTouchAnchor(null);
        setSelection(null);
        return;
    }
  };

  // --- drawing ----------------------------------------------------------------

  const limited = result.limited;
  const searchLimited = search?.limited ?? false;
  const warning = searchLimited
    ? labels.searchBudget
    : limited
      ? labels.rowBudget(ROW_BUDGET_TEXT)
      : expandLimited
        ? labels.expandBudget
        : null;

  const virtualItems = virtualizer.getVirtualItems();
  const focusIndex = focusPath === null ? undefined : index.get(focusPath);
  const ownValue =
    geometry?.kind === "value" && geometry.ownRow ? geometry.first : -1;
  const keyRow = geometry?.kind === "key" ? geometry.first : -1;

  return (
    <Pane
      purpose="document"
      data-slot="json-view"
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-frame border bg-background text-foreground",
        fill && "h-full min-h-0",
        className,
      )}
    >
      <Pane
        purpose="toolbar"
        role="toolbar"
        aria-label={labels.toolbar}
        className="flex flex-none flex-wrap items-center gap-0.5 border-b bg-muted px-1 py-0.5 raymond:mb-0.5 raymond:pl-2.5"
      >
        <ToolbarButton
          size="icon-sm"
          aria-label={labels.collapseAll}
          title={labels.collapseAll}
          onClick={collapseAll}
        >
          <ChevronsDownUpIcon />
        </ToolbarButton>
        <ToolbarButton
          size="icon-sm"
          aria-label={labels.expandAll}
          title={labels.expandAll}
          onClick={expandAll}
        >
          <ChevronsUpDownIcon />
        </ToolbarButton>
        <ToolbarButton
          size="icon-sm"
          aria-label={labels.copyDocument}
          title={labels.copyDocument}
          onClick={() => void copyDocument()}
        >
          {copiedDocument ? <CheckIcon data-icon="copied" /> : <CopyIcon />}
        </ToolbarButton>
        <span className="sr-only" aria-live="polite">
          {copiedDocument ? labels.copied : ""}
        </span>
        <ToolbarButton
          size="icon-sm"
          aria-label={labels.wrap}
          title={labels.wrap}
          aria-pressed={wrap}
          className="aria-pressed:bg-accent aria-pressed:pressed-cue"
          onClick={() => setWrap(!wrap)}
        >
          <WrapTextIcon />
        </ToolbarButton>
        {inspectRoot && (
          <ToolbarButton
            size="icon-sm"
            aria-label={labels.inspectDocument}
            title={labels.inspectDocument}
            onClick={() => openInspect("$")}
          >
            <Maximize2Icon />
          </ToolbarButton>
        )}
        <div className="ml-auto flex min-w-0 items-center gap-1">
          {query && (
            <span
              role="status"
              className="px-1 font-mono text-muted-foreground text-ui-xs tabular-nums"
            >
              {labels.matches(search?.matched.size ?? 0)}
            </span>
          )}
          <div className="relative flex min-w-0 items-center">
            <SearchIcon
              aria-hidden
              className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground"
            />
            <Input
              ref={searchInput}
              type="search"
              value={queryInput}
              aria-label={labels.search}
              placeholder={labels.search}
              className="h-control-sm w-52 max-w-full pl-7"
              onChange={(event) => setQueryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape" || !queryInput) return;
                event.preventDefault();
                clearSearch();
              }}
            />
          </div>
        </div>
      </Pane>

      {warning && !warnDismissed && (
        <WarningStrip
          dismiss={labels.dismiss}
          onDismiss={() => setWarnDismissed(true)}
        >
          {warning}
        </WarningStrip>
      )}

      <div
        ref={scroller}
        role="tree"
        tabIndex={0}
        aria-label={labels.toolbar}
        aria-multiselectable
        aria-activedescendant={
          focusIndex !== undefined &&
          virtualItems.some((v) => v.index === focusIndex)
            ? `${baseId}-${focusIndex}`
            : undefined
        }
        data-slot="json-view-tree"
        className={cn(
          "group/json relative min-h-0 overflow-auto overscroll-contain py-0.5 outline-none [contain:content]",
          fill ? "flex-1" : "flex-none",
        )}
        style={fill ? undefined : { maxHeight }}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        <div
          ref={probe}
          aria-hidden
          className="pointer-events-none invisible absolute h-row-dense w-0 touch:h-11"
        />
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          <SelectionBlock geometry={geometry} virtualizer={virtualizer} />
          {virtualItems.map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            const at = item.index;
            const inBlock =
              geometry !== null &&
              geometry.kind !== "key" &&
              at >= geometry.first &&
              at <= geometry.last &&
              at !== ownValue;
            const focused = at === focusIndex;
            const path = row.path;
            return (
              <JsonRowView
                key={item.key}
                row={row}
                id={`${baseId}-${at}`}
                index={at}
                start={item.start}
                wrap={wrap}
                needle={needle}
                labels={labels}
                inBlock={inBlock}
                valueSelected={at === ownValue}
                keySelected={at === keyRow}
                focused={focused}
                showMenu={
                  focused || inBlock || at === ownValue || at === keyRow
                }
                measureRef={wrap ? virtualizer.measureElement : undefined}
                menu={
                  row.kind === "comment"
                    ? null
                    : {
                        open: menuPath === path,
                        onOpenChange: (open) => {
                          if (open) {
                            if (!covered(at)) {
                              setSelection({ type: "value", path });
                            }
                            setMenuPath(path);
                          } else {
                            setMenuPath(null);
                          }
                        },
                        items: menuItems,
                        onCloseAutoFocus: (event) => {
                          event.preventDefault();
                          scroller.current?.focus({ preventScroll: true });
                        },
                      }
                }
              />
            );
          })}
        </div>
      </div>

      <InspectDialog
        target={inspect}
        labels={labels}
        onClose={() => {
          setInspect(null);
          scrollToPath(focusPath);
        }}
        renderTree={(inner) => (
          <JsonView
            value={inner}
            fill
            inspectRoot={false}
            summary={summary}
            labels={labelsProp}
            wrap={wrap}
            onWrapChange={setWrap}
          />
        )}
      />
    </Pane>
  );
}

/**
 * The block painted under the rows a members range or an open value's subtree covers, from the
 * members' indent, or the children's, to the right edge.
 */
function SelectionBlock({
  geometry,
  virtualizer,
}: {
  geometry: SelectionGeometry | null;
  virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>;
}) {
  if (!geometry || geometry.kind === "key") return null;
  const first = geometry.ownRow ? geometry.first + 1 : geometry.first;
  if (first > geometry.last) return null;
  const measurements = virtualizer.measurementsCache;
  const top = measurements[first]?.start;
  const bottom = measurements[geometry.last]?.end;
  if (top === undefined || bottom === undefined) return null;
  return (
    <div
      aria-hidden
      data-slot="json-selection"
      className={cn(
        "pointer-events-none absolute right-0",
        FILL_CLASS,
        TICK_CLASS,
      )}
      style={{ top, height: bottom - top, left: indentOf(geometry.depth) }}
    />
  );
}
