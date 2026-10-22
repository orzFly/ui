import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import {
  type CSSProperties,
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  type RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { type ColumnMetrics, fitColumns, rowWidth } from "./column-fit.ts";
import {
  encodingLabel,
  getTextDecoding,
  HEX_ENCODINGS,
  type HexEncoding,
  type HexEncodingInfo,
} from "./encodings.ts";
import {
  addressDigits,
  copyText,
  formatAddress,
  formatOffset,
  formatSize,
  hexByte,
  MAX_COPY_BYTES,
} from "./format.ts";
import { navigate } from "./navigation.ts";
import { createPageCache, type PageCache } from "./page-cache.ts";
import {
  clampTopRow,
  scrollFromTopRow,
  scrollGeometry,
  topRowFromScroll,
} from "./scroll-map.ts";
import type { ByteSource } from "./source.ts";
import {
  glyphCells,
  type TextCell,
  type TextDecoding,
} from "./text-decoding.ts";
import {
  type ControlCodes,
  type HexPane,
  type HexSelection,
  sameSelection,
} from "./types.ts";

export type { HexPane, HexSelection } from "./types.ts";

export interface HexViewHandle {
  scrollToOffset(offset: number, align?: "nearest" | "start" | "center"): void;
  focus(): void;
}

export type HexCopyResult =
  | { ok: true; bytes: number }
  | {
      ok: false;
      reason: "too-large" | "read-failed" | "clipboard-unavailable";
    };

export interface HexViewProps {
  source: ByteSource;
  selection?: HexSelection | null;
  defaultSelection?: HexSelection | null;
  onSelectionChange?: (selection: HexSelection | null) => void;
  /**
   * Bytes per row; 16. `"auto"` picks the widest of `maxColumns` and the
   * powers of two below it, down to 4, that fits the view's width.
   */
  columns?: number | "auto";
  /** The most columns `"auto"` picks; 16. */
  maxColumns?: number;
  /** Bytes per group, separated by a gap; 8, and 0 for no gap. */
  groupSize?: number;
  /** Added to every displayed address, never to selection offsets; 0. */
  baseAddress?: number;
  /** A fixed viewport height in rows; omitted, the view fills its parent. */
  rows?: number;
  /** A resize handle in the bottom corner; `true` resizes both ways. */
  resizable?: boolean | "horizontal" | "vertical";
  showAddresses?: boolean;
  showColumnLabels?: boolean;
  /** The text pane beside the hex pane. */
  showText?: boolean;
  showStatusBar?: boolean;
  uppercase?: boolean;
  fadeZeroBytes?: boolean;
  controlCodes?: ControlCodes;
  /** How the text pane decodes the bytes; controlled when set. */
  encoding?: HexEncoding;
  /** "ascii". */
  defaultEncoding?: HexEncoding;
  onEncodingChange?: (encoding: HexEncoding) => void;
  /** The encoding picker in the text pane's header; true. */
  showEncodingPicker?: boolean;
  onCopy?: (result: HexCopyResult) => void;
  onReadError?: (error: unknown, offset: number) => void;
  ref?: Ref<HexViewHandle>;
  className?: string;
  "aria-label"?: string;
}

/** What the grid hands an editor: the pieces of the view its commands drive. */
export interface GridContext {
  cache: PageCache;
  /** The active encoding's decoding; an editor encodes typed text through it. */
  decoding: TextDecoding;
  /** Scrolls the offset into view. */
  reveal(offset: number): void;
  /** Speaks a selection like a keyboard move does, or a message. */
  announce(what: HexSelection | null | string): void;
  /** The copy path for the selection, excluding the append cell; `onCopied` runs once the text is on the clipboard. */
  copy(event: ClipboardEvent, onCopied?: () => void): void;
  focus(): void;
}

/** Turns the grid into an editor's surface; `HexView` renders without it. */
export interface GridEditing {
  /** Runs ahead of navigation; true when it took the key. */
  onKey(event: ReactKeyboardEvent<HTMLDivElement>, ctx: GridContext): boolean;
  /** A click or a navigation key moved the caret. */
  onCaretMove(): void;
  onPaste(event: ClipboardEvent, ctx: GridContext): void;
  onCut(event: ClipboardEvent, ctx: GridContext): void;
  /** One empty cell after the last byte, where typing appends. */
  appendCell: boolean;
  /** Refuses every edit, so the encoder is never warmed up. */
  readOnly: boolean;
  mode: "overwrite" | "insert";
  modifiedRanges(offset: number, length: number): Array<[number, number]>;
  statusExtra?: ReactNode;
  /** Filled on every render, for commands that arrive outside a grid event. */
  contextRef: RefObject<GridContext | null>;
}

// happy-dom and a detached tree lay out at 0; 1.375rem at a 16px root.
const FALLBACK_ROW_HEIGHT = 22;
const AUTO_SCROLL_STEP_PX = 20;
const AUTO_SCROLL_MAX_ROWS = 4;

export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/** Controlled when `value` is not `undefined`, like a radix primitive. */
function useControllable<T>(
  value: T | undefined,
  defaultValue: T,
  onChange: ((value: T) => void) | undefined,
  same: (a: T, b: T) => boolean,
) {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const currentRef = useLatest(current);
  const onChangeRef = useLatest(onChange);
  const set = useCallback(
    (next: T) => {
      if (same(currentRef.current, next)) return;
      if (!controlled) {
        // Later calls in the same event see this one before the re-render.
        currentRef.current = next;
        setInner(next);
      }
      onChangeRef.current?.(next);
    },
    [controlled, currentRef, onChangeRef, same],
  );
  return [current, set, currentRef] as const;
}

export function useControllableSelection(
  value: HexSelection | null | undefined,
  defaultValue: HexSelection | null | undefined,
  onChange: ((selection: HexSelection | null) => void) | undefined,
) {
  return useControllable(value, defaultValue ?? null, onChange, sameSelection);
}

const ENCODING_GROUPS = HEX_ENCODINGS.reduce<
  Array<{ group: HexEncodingInfo["group"]; entries: HexEncodingInfo[] }>
>((groups, info) => {
  const lastGroup = groups.at(-1);
  if (lastGroup?.group === info.group) lastGroup.entries.push(info);
  else groups.push({ group: info.group, entries: [info] });
  return groups;
}, []);

function useElementSize(
  ref: RefObject<HTMLElement | null>,
  read: (el: HTMLElement) => number,
) {
  const [value, setValue] = useState(0);
  const readRef = useLatest(read);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setValue(readRef.current(el));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, readRef]);
  return value;
}

interface Hit {
  offset: number;
  pane: HexPane;
}

interface HoverRange {
  start: number;
  end: number;
}

function hitFromElement(el: Element | null, grid: Element): Hit | null {
  const cell = el?.closest?.("[data-offset]");
  if (!cell || !grid.contains(cell)) return null;
  const offset = Number(cell.getAttribute("data-offset"));
  if (!Number.isFinite(offset)) return null;
  const pane = cell.getAttribute("data-pane") === "text" ? "text" : "hex";
  return { offset, pane };
}

export function HexGrid({
  source,
  selection: selectionProp,
  defaultSelection,
  onSelectionChange,
  columns: columnsProp = 16,
  maxColumns = 16,
  groupSize = 8,
  baseAddress = 0,
  rows,
  resizable = false,
  showAddresses = true,
  showColumnLabels = true,
  showText = true,
  showStatusBar = true,
  uppercase = true,
  fadeZeroBytes = true,
  controlCodes = "abbreviations",
  encoding: encodingProp,
  defaultEncoding = "ascii",
  onEncodingChange,
  showEncodingPicker = true,
  onCopy,
  onReadError,
  ref,
  className,
  "aria-label": ariaLabel = "Hex view",
  editing,
}: HexViewProps & { editing?: GridEditing }) {
  const [selection, setSelection, selectionRef] = useControllableSelection(
    selectionProp,
    defaultSelection,
    onSelectionChange,
  );
  const [encoding, setEncoding] = useControllable(
    encodingProp,
    defaultEncoding,
    onEncodingChange,
    Object.is,
  );
  const decoding = useMemo(() => getTextDecoding(encoding), [encoding]);
  // An id this runtime lacks renders ASCII, and the header says so.
  const shownEncoding: HexEncoding = HEX_ENCODINGS.some(
    (info) => info.id === encoding,
  )
    ? encoding
    : "ascii";

  const [readError, setReadError] = useState<{
    cache: PageCache;
    offset: number;
  } | null>(null);
  const onReadErrorRef = useLatest(onReadError);
  const cache = useMemo<PageCache>(() => {
    const created = createPageCache(source, {
      onError: (error, offset) => {
        setReadError({ cache: created, offset });
        onReadErrorRef.current?.(error, offset);
      },
    });
    return created;
  }, [source, onReadErrorRef]);
  // Shown while that page is still failed: a retry or a change clears it.
  const readErrorOffset =
    readError?.cache === cache &&
    cache.status(Math.floor(readError.offset / cache.pageSize)) === "error"
      ? readError.offset
      : null;
  useSyncExternalStore(cache.subscribe, cache.version, cache.version);
  const size = source.size;

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const autoColumns = columnsProp === "auto";
  const fit = useColumnFit(
    autoColumns,
    maxColumns,
    groupSize,
    rootRef,
    scrollerRef,
    measureRef,
  );
  const columns = autoColumns ? (fit?.columns ?? maxColumns) : columnsProp;

  const rowHeight =
    useElementSize(probeRef, (el) => el.getBoundingClientRect().height) ||
    FALLBACK_ROW_HEIGHT;
  const headerHeight = showColumnLabels ? rowHeight : 0;
  const scrollerHeight = useElementSize(scrollerRef, (el) => el.clientHeight);
  // A horizontal scrollbar takes its height out of the rows; a fixed `rows`
  // height grows by it so that all of them still show.
  const scrollbarHeight = useElementSize(
    scrollerRef,
    (el) => el.offsetHeight - el.clientHeight,
  );
  const viewportHeight =
    scrollerHeight > headerHeight
      ? scrollerHeight - headerHeight
      : (rows ?? 0) * rowHeight;

  const appendCell = editing?.appendCell ?? false;
  // The highest offset the caret reaches: the append cell, when there is one.
  const maxOffset = appendCell ? size : size - 1;
  const totalRows = Math.ceil((maxOffset + 1) / columns);
  const geometry = useMemo(
    () => scrollGeometry(totalRows, rowHeight, viewportHeight),
    [totalRows, rowHeight, viewportHeight],
  );
  const geometryRef = useLatest(geometry);

  const [topRowState, setTopRowState] = useState(0);
  // A new row width keeps the byte at the top left in the top row.
  const [topColumns, setTopColumns] = useState(columns);
  if (topColumns !== columns) {
    setTopColumns(columns);
    setTopRowState(Math.floor((topRowState * topColumns) / columns));
  }
  const topRow = clampTopRow(topRowState, geometry);
  const topRowRef = useLatest(topRow);
  const lastWritten = useRef(-1);
  const wheelRows = useRef(0);

  const setTop = useCallback(
    (row: number) => {
      const g = geometryRef.current;
      const next = clampTopRow(row, g);
      topRowRef.current = next;
      setTopRowState(next);
      const el = scrollerRef.current;
      if (el) {
        const scrollTop = scrollFromTopRow(next, g);
        lastWritten.current = scrollTop;
        el.scrollTop = scrollTop;
      }
    },
    [geometryRef, topRowRef],
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const g = geometryRef.current;
      const scrollTop = el.scrollTop;
      if (g.scaled && Math.abs(scrollTop - lastWritten.current) <= 1) return;
      lastWritten.current = scrollTop;
      const next = topRowFromScroll(scrollTop, g);
      topRowRef.current = next;
      setTopRowState(next);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [geometryRef, topRowRef]);

  // Scaled, one wheel notch would otherwise cross megabytes of rows.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !geometry.scaled) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.deltaY === 0) return;
      event.preventDefault();
      const g = geometryRef.current;
      const unit =
        event.deltaMode === 1
          ? g.rowHeight
          : event.deltaMode === 2
            ? g.viewportRows * g.rowHeight
            : 1;
      // Trackpads send a few pixels at a time; they add up to whole rows.
      wheelRows.current += (event.deltaY * unit) / g.rowHeight;
      const step = Math.trunc(wheelRows.current);
      wheelRows.current -= step;
      if (step) setTop(topRowRef.current + step);
      if (event.deltaX) el.scrollLeft += event.deltaX * unit;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [geometry.scaled, geometryRef, topRowRef, setTop]);

  // A resize, a size change or a switch between 1:1 and scaled moves the
  // mapping under the top row; the element keeps its old scrollTop.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (topRowFromScroll(el.scrollTop, geometry) === topRowRef.current) return;
    const scrollTop = scrollFromTopRow(topRowRef.current, geometry);
    lastWritten.current = scrollTop;
    el.scrollTop = scrollTop;
  }, [geometry, topRowRef]);

  const lastRow = Math.min(totalRows - 1, topRow + geometry.viewportRows - 1);

  const { lookbehind, lookahead } = decoding;
  const firstPage = Math.floor(
    Math.max(0, topRow * columns - lookbehind) / cache.pageSize,
  );
  const lastPage = Math.floor(
    Math.max(0, Math.min(size, (lastRow + 1) * columns + lookahead) - 1) /
      cache.pageSize,
  );
  const hasRows = lastRow >= topRow;
  // Keyed on pages, not rows: a failed page is retried when it comes back
  // into view, not on every row scrolled.
  useEffect(() => {
    if (!hasRows) return;
    cache.retain(firstPage, lastPage);
    cache.request(firstPage, lastPage);
  }, [cache, firstPage, lastPage, hasRows]);

  const scrollToOffset = useCallback(
    (offset: number, align: "nearest" | "start" | "center" = "nearest") => {
      const g = geometryRef.current;
      const row = Math.floor(Math.max(0, offset) / columns);
      const visibleRows = g.viewportRows;
      const top = topRowRef.current;
      if (align === "start") setTop(row);
      else if (align === "center")
        setTop(row - Math.floor((visibleRows - 1) / 2));
      else if (row < top) setTop(row);
      else if (row + 1 > top + visibleRows) setTop(row + 1 - visibleRows);
    },
    [columns, geometryRef, topRowRef, setTop],
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollToOffset,
      focus: () => rootRef.current?.focus({ preventScroll: true }),
    }),
    [scrollToOffset],
  );

  // Pointer

  // The hovered byte; its glyph's range is derived as rows render, so an
  // encoding switch or an edit under a resting pointer cannot leave a stale one.
  const [hoverOffset, setHover] = useState(-1);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    frame: number;
  } | null>(null);

  const cellAt = useCallback(
    (event: {
      target: EventTarget | null;
      clientX: number;
      clientY: number;
    }) => {
      const grid = scrollerRef.current;
      if (!grid) return null;
      const direct = hitFromElement(event.target as Element | null, grid);
      if (direct) return direct;
      // Pointer capture retargets every move to the grid itself.
      if (
        event.target === grid &&
        typeof document.elementFromPoint === "function"
      ) {
        return hitFromElement(
          document.elementFromPoint(event.clientX, event.clientY),
          grid,
        );
      }
      return null;
    },
    [],
  );

  const extendTo = useCallback(
    (hit: Hit) => {
      const current = selectionRef.current;
      setSelection({
        anchor: current ? current.anchor : hit.offset,
        focus: hit.offset,
        pane: hit.pane,
      });
    },
    [selectionRef, setSelection],
  );

  const autoScroll = useCallback(() => {
    const state = drag.current;
    const grid = scrollerRef.current;
    if (!state || !grid) return;
    const rect = grid.getBoundingClientRect();
    const top =
      rect.top + (showColumnLabels ? geometryRef.current.rowHeight : 0);
    const bottom =
      top + geometryRef.current.viewportRows * geometryRef.current.rowHeight;
    const outside =
      state.y < top ? state.y - top : state.y > bottom ? state.y - bottom : 0;
    if (outside === 0) {
      state.frame = 0;
      return;
    }
    const step = Math.min(
      AUTO_SCROLL_MAX_ROWS,
      Math.ceil(Math.abs(outside) / AUTO_SCROLL_STEP_PX),
    );
    setTop(topRowRef.current + Math.sign(outside) * step);
    const y = outside < 0 ? top + 1 : bottom - 1;
    const hit = hitFromElement(document.elementFromPoint?.(state.x, y), grid);
    if (hit) extendTo(hit);
    state.frame = requestAnimationFrame(autoScroll);
  }, [showColumnLabels, geometryRef, topRowRef, setTop, extendTo]);

  const endDrag = useCallback(() => {
    const state = drag.current;
    if (!state) return;
    if (state.frame) cancelAnimationFrame(state.frame);
    drag.current = null;
    setDragging(false);
  }, []);

  useEffect(() => endDrag, [endDrag]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const hit = cellAt(event);
    if (!hit) return;
    event.preventDefault();
    rootRef.current?.focus({ preventScroll: true });
    editing?.onCaretMove();
    const current = selectionRef.current;
    if (event.shiftKey && current) {
      setSelection({
        anchor: current.anchor,
        focus: hit.offset,
        pane: hit.pane,
      });
    } else {
      setSelection({ anchor: hit.offset, focus: hit.offset, pane: hit.pane });
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic or already-released pointer cannot be captured.
    }
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      frame: 0,
    };
    setDragging(true);
    setHover(-1);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) {
      setHover(cellAt(event)?.offset ?? -1);
      return;
    }
    state.x = event.clientX;
    state.y = event.clientY;
    const hit = cellAt(event);
    if (hit) extendTo(hit);
    if (!state.frame) state.frame = requestAnimationFrame(autoScroll);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released.
    }
    endDrag();
  };

  // Keyboard

  /** The cell `offset` shows, decoded from its row's window as the row renders it. */
  const decodedCell = useCallback(
    (offset: number): TextCell | undefined => {
      const rowStart = offset - (offset % columns);
      const length = Math.min(columns, size - rowStart);
      if (offset - rowStart >= length) return undefined;
      const ws = Math.max(0, rowStart - decoding.lookbehind);
      const we = Math.min(size, rowStart + length + decoding.lookahead);
      const window = cache.get(ws, we - ws);
      if (!window) return undefined;
      return decoding.decodeRow(
        window,
        { start: rowStart, before: rowStart - ws, length },
        "abbreviations",
      )[offset - rowStart];
    },
    [cache, columns, decoding, size],
  );

  const announce = useCallback(
    (sel: HexSelection | null | string) => {
      const live = liveRef.current;
      if (!live) return;
      if (typeof sel === "string") {
        live.textContent = sel;
        return;
      }
      if (!sel) {
        live.textContent = "No selection";
        return;
      }
      const start = Math.min(sel.anchor, sel.focus);
      const end = Math.max(sel.anchor, sel.focus);
      if (start !== end) {
        live.textContent = `${formatOffset(baseAddress + start)}–${formatOffset(baseAddress + end)}, ${end - start + 1} bytes`;
        return;
      }
      const byte = cache.get(sel.focus, 1)?.[0];
      let text = formatOffset(baseAddress + sel.focus);
      if (byte !== undefined) {
        let cell = decodedCell(sel.focus);
        if (cell?.kind === "continuation" && cell.lead !== undefined) {
          cell = decodedCell(cell.lead);
        }
        // UI-5 spoke a control's abbreviation too, whatever `controlCodes` draws.
        const glyph =
          cell?.kind === "char" || cell?.kind === "control"
            ? cell.text
            : undefined;
        text += `: ${hexByte(byte, uppercase)}${glyph ? ` (${glyph})` : ""}`;
      }
      live.textContent = text;
    },
    [baseAddress, cache, decodedCell, uppercase],
  );

  // The one place keys are handled; editing hooks its input in here.
  const handleKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // Keys from the encoding picker, its portalled list included, bubble here
    // through React; they must not move the caret.
    if (event.target !== event.currentTarget) return;
    if (editing?.onKey(event, context)) return;
    const current = selectionRef.current;
    const g = geometryRef.current;
    const pageRows = g.viewportRows;
    const next = navigate(
      current,
      {
        key: event.key,
        shift: event.shiftKey,
        mod: event.ctrlKey || event.metaKey,
      },
      {
        columns,
        size,
        pageRows,
        maxOffset,
        firstVisible: Math.min(maxOffset, topRowRef.current * columns),
        pane: current?.pane ?? "hex",
      },
    );
    if (next === undefined) return;
    event.preventDefault();
    if (next === current) return;
    editing?.onCaretMove();
    setSelection(next);
    if (next) scrollToOffset(next.focus, "nearest");
    announce(next);
  };

  // Copy

  const onCopyRef = useLatest(onCopy);
  const copy = useCallback(
    (event: ClipboardEvent, onCopied?: () => void) => {
      const sel = selectionRef.current;
      if (!sel) return;
      const start = Math.min(sel.anchor, sel.focus);
      // An editor's append cell holds no byte to copy.
      const end = Math.min(Math.max(sel.anchor, sel.focus), source.size - 1);
      if (end < start) return;
      const length = end - start + 1;
      const report = (result: HexCopyResult) => {
        onCopyRef.current?.(result);
        if (result.ok) onCopied?.();
      };
      event.preventDefault();
      if (length > MAX_COPY_BYTES) {
        report({ ok: false, reason: "too-large" });
        return;
      }
      const textPane = sel.pane === "text";
      const from = textPane ? Math.max(0, start - decoding.lookbehind) : start;
      const to = textPane
        ? Math.min(source.size, end + 1 + decoding.lookahead)
        : end + 1;
      const text = (bytes: Uint8Array) =>
        copyText(
          bytes,
          sel.pane,
          uppercase,
          decoding,
          start - from,
          start,
          length,
        );
      const bytes = cache.get(from, to - from);
      if (bytes && event.clipboardData) {
        event.clipboardData.setData("text/plain", text(bytes));
        report({ ok: true, bytes: length });
        return;
      }
      const clipboard =
        typeof navigator === "undefined" ? undefined : navigator.clipboard;
      if (!clipboard?.writeText) {
        report({ ok: false, reason: "clipboard-unavailable" });
        return;
      }
      cache.readRange(from, to - from).then(
        (read) =>
          clipboard.writeText(text(read)).then(
            () => report({ ok: true, bytes: length }),
            () => report({ ok: false, reason: "clipboard-unavailable" }),
          ),
        () => report({ ok: false, reason: "read-failed" }),
      );
    },
    [cache, decoding, onCopyRef, selectionRef, source, uppercase],
  );

  const context: GridContext = {
    cache,
    decoding,
    reveal: (offset) => scrollToOffset(offset, "nearest"),
    announce,
    copy,
    focus: () => rootRef.current?.focus({ preventScroll: true }),
  };
  if (editing) editing.contextRef.current = context;
  const contextRef = useLatest(context);
  const editingRef = useLatest(editing);
  const isEditor = editing !== undefined;
  const writable = isEditor && !editing.readOnly;

  // Warms the encoder up before the first keystroke needs it.
  useEffect(() => {
    if (!writable || !decoding.prepareEncode) return;
    const prepare = () => decoding.prepareEncode?.();
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(prepare);
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(prepare, 0);
    return () => clearTimeout(id);
  }, [decoding, writable]);

  // Chromium fires `copy` at the body, not at a focused non-editable element,
  // when nothing is selected in the document; listening on the document
  // catches both, and the menu's Copy too. Cut and paste arrive the same way.
  useEffect(() => {
    const ours = (event: ClipboardEvent) => {
      const root = rootRef.current;
      if (!root || event.defaultPrevented) return false;
      // Copying a selected encoding label stays native.
      if (headerRef.current?.contains(event.target as Node)) return false;
      const active = document.activeElement;
      return active === root || root.contains(event.target as Node);
    };
    const onDocumentCopy = (event: ClipboardEvent) => {
      if (ours(event)) copy(event);
    };
    const onDocumentCut = (event: ClipboardEvent) => {
      if (ours(event)) editingRef.current?.onCut(event, contextRef.current);
    };
    const onDocumentPaste = (event: ClipboardEvent) => {
      if (ours(event)) editingRef.current?.onPaste(event, contextRef.current);
    };
    document.addEventListener("copy", onDocumentCopy);
    if (isEditor) {
      document.addEventListener("cut", onDocumentCut);
      document.addEventListener("paste", onDocumentPaste);
    }
    return () => {
      document.removeEventListener("copy", onDocumentCopy);
      document.removeEventListener("cut", onDocumentCut);
      document.removeEventListener("paste", onDocumentPaste);
    };
  }, [copy, isEditor, editingRef, contextRef]);

  // Render

  const selStart = selection ? Math.min(selection.anchor, selection.focus) : -1;
  const selEnd = selection ? Math.max(selection.anchor, selection.focus) : -1;
  // The append cell takes the caret but is never part of the highlighted range.
  const selLast = Math.min(selEnd, size - 1);
  const caret = selection ? selection.focus : -1;
  // The nibble counts only in the hex pane; from the text pane the hex twin
  // keeps the whole-byte underline.
  const caretNibble = editing
    ? selection?.pane === "text"
      ? undefined
      : (selection?.nibble ?? 0)
    : undefined;
  const digits = addressDigits(
    baseAddress + Math.max(0, (totalRows - 1) * columns),
  );

  const glyphRange = (offset: number): HoverRange => {
    const cell = showText && offset < size ? decodedCell(offset) : undefined;
    const lead = cell?.kind === "continuation" ? cell.lead : offset;
    if (lead === undefined) return { start: offset, end: offset };
    // The lead's own cell knows the glyph's length, even when the glyph
    // crosses more than one row end.
    const length = (lead === offset ? cell : decodedCell(lead))?.length ?? 1;
    return length > 1
      ? { start: lead, end: Math.min(size - 1, lead + length - 1) }
      : { start: offset, end: offset };
  };
  const hover = hoverOffset >= 0 ? glyphRange(hoverOffset) : null;

  const rowElements = [];
  for (let row = topRow; row <= lastRow; row++) {
    const rowStart = row * columns;
    const length = Math.min(columns, size - rowStart);
    const windowStart = Math.max(0, rowStart - lookbehind);
    const windowEnd = Math.min(size, rowStart + length + lookahead);
    const windowBytes = cache.get(windowStart, windowEnd - windowStart);
    // The hex pane needs only the row's own bytes: a failed or loading page
    // in the decoder's lookbehind or lookahead holds back the text pane alone.
    const own = windowBytes ?? cache.get(rowStart, length);
    // A copy: a sync source may change its buffer in place, and the row's
    // memo compares the bytes it last rendered with these.
    const bytes = own?.slice();
    const state = own
      ? "ready"
      : rangeState(cache, rowStart, rowStart + length);
    const textState = windowBytes
      ? "ready"
      : rangeState(cache, windowStart, windowEnd);
    const rowEnd = rowStart + length - 1;
    const append = appendCell && size - rowStart < columns;
    const cellEnd = append ? rowEnd + 1 : rowEnd;
    const inSel = selStart <= rowEnd && selLast >= rowStart && selStart >= 0;
    const hovered =
      hover !== null && hover.start <= cellEnd && hover.end >= rowStart;
    let modified = "";
    if (editing && length > 0) {
      modified = editing
        .modifiedRanges(rowStart, length)
        .map(
          ([from, to]) =>
            `${Math.max(from, rowStart) - rowStart}-${Math.min(to, rowStart + length) - rowStart}`,
        )
        .join(",");
    }
    rowElements.push(
      <HexRow
        key={row}
        rowStart={rowStart}
        length={length}
        append={append}
        modified={modified}
        bytes={bytes}
        before={windowBytes ? rowStart - windowStart : 0}
        state={state}
        textState={textState}
        selFrom={inSel ? Math.max(selStart, rowStart) : -1}
        selTo={inSel ? Math.min(selLast, rowEnd) : -1}
        hoverFrom={hovered ? Math.max(hover.start, rowStart) : -1}
        hoverTo={hovered ? Math.min(hover.end, cellEnd) : -1}
        caret={caret >= rowStart && caret <= cellEnd ? caret : -1}
        caretNibble={caretNibble}
        columns={columns}
        groupSize={groupSize}
        address={
          showAddresses
            ? formatAddress(baseAddress + rowStart, digits, uppercase)
            : undefined
        }
        uppercase={uppercase}
        fadeZeroBytes={fadeZeroBytes}
        controlCodes={controlCodes}
        showText={showText}
        decoding={decoding}
        encoding={encoding}
      />,
    );
  }

  const resize = resizable === true ? "both" : resizable || undefined;
  const rowsHeight =
    rows === undefined
      ? undefined
      : `calc(var(--hex-row-height) * ${rows + (showColumnLabels ? 1 : 0)} + ${scrollbarHeight}px)`;

  const pending = cache.pending();
  let statusLeft = "";
  if (selection) {
    statusLeft =
      selStart >= selLast
        ? formatOffset(baseAddress + caret)
        : `${formatOffset(baseAddress + selStart)}–${formatOffset(baseAddress + selLast)} · ${selLast - selStart + 1} bytes`;
  }

  return (
    <div
      ref={rootRef}
      className={className ? `orz-hex ${className}` : "orz-hex"}
      style={
        fit
          ? ({ "--hex-auto-width": `${fit.width}px` } as CSSProperties)
          : undefined
      }
      data-active-pane={selection?.pane ?? "hex"}
      data-columns-auto={autoColumns ? "" : undefined}
      data-resizable={resize}
      data-dragging={dragging ? "" : undefined}
      data-fill={rows === undefined ? "" : undefined}
      data-mode={editing?.mode}
      // A custom keyboard widget over a virtualised range: an ARIA grid
      // could not stay truthful past the rendered rows.
      role="application"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the view itself is the focus target
      tabIndex={0}
      aria-label={ariaLabel}
      aria-roledescription={editing ? "hex editor" : "hex view"}
      onKeyDown={handleKey}
    >
      <div ref={probeRef} className="orz-hex-probe" aria-hidden />
      {autoColumns && (
        <div
          ref={measureRef}
          className="orz-hex-row orz-hex-measure"
          aria-hidden
        >
          {showAddresses && (
            <span className="orz-hex-addr" data-measure="addr">
              {formatAddress(baseAddress, digits, uppercase)}
            </span>
          )}
          <span className="orz-hex-cell" data-measure="hex">
            <span className="orz-hex-cell-content">00</span>
          </span>
          <span
            className="orz-hex-cell"
            data-measure="group-end"
            data-group-end=""
          >
            <span className="orz-hex-cell-content">00</span>
          </span>
          {showText && (
            <>
              <span className="orz-hex-pane-gap" data-measure="gap" />
              <span
                className="orz-hex-cell orz-hex-text-cell"
                data-measure="text"
              />
            </>
          )}
        </div>
      )}
      <div
        ref={scrollerRef}
        className="orz-hex-scroller"
        style={
          rowsHeight === undefined
            ? undefined
            : // A handle that drags the height lets the rows follow it.
              resize === "both" || resize === "vertical"
              ? { flex: `1 1 ${rowsHeight}` }
              : { height: rowsHeight }
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={endDrag}
        onPointerLeave={() => {
          if (!drag.current) setHover(-1);
        }}
      >
        {showColumnLabels && (
          <div ref={headerRef} className="orz-hex-row orz-hex-header">
            <span className="orz-hex-header-labels" aria-hidden>
              {showAddresses && (
                <span
                  className="orz-hex-addr"
                  style={{ width: `${digits}ch` }}
                />
              )}
              {Array.from({ length: columns }, (_, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
                  key={i}
                  className="orz-hex-cell"
                  data-group-end={
                    isGroupEnd(i, columns, groupSize) ? "" : undefined
                  }
                >
                  <span className="orz-hex-cell-content">
                    {hexByte(i, uppercase)}
                  </span>
                </span>
              ))}
              {showText && <span className="orz-hex-pane-gap" />}
            </span>
            {showText && (
              <span
                className="orz-hex-text-label"
                style={{ width: `calc(var(--hex-text-cell) * ${columns})` }}
              >
                {showEncodingPicker ? (
                  <EncodingPicker
                    value={shownEncoding}
                    onChange={setEncoding}
                  />
                ) : (
                  encodingLabel(shownEncoding)
                )}
              </span>
            )}
          </div>
        )}
        <div
          className="orz-hex-spacer"
          style={{ height: `${geometry.spacerHeight}px` }}
        >
          <div className="orz-hex-layer" style={{ top: headerHeight }}>
            {rowElements}
          </div>
        </div>
      </div>
      {showStatusBar && (
        <div className="orz-hex-status">
          <span>
            {statusLeft}
            {pending
              ? `${statusLeft ? " · " : ""}Loading…`
              : readErrorOffset !== null
                ? `${statusLeft ? " · " : ""}Read failed at ${formatOffset(baseAddress + readErrorOffset)}`
                : ""}
          </span>
          {editing?.statusExtra ? (
            <span className="orz-hex-status-end">
              {editing.statusExtra}
              <span>{formatSize(size)}</span>
            </span>
          ) : (
            <span>{formatSize(size)}</span>
          )}
        </div>
      )}
      <div ref={liveRef} className="orz-hex-live" aria-live="polite" />
    </div>
  );
}

interface ColumnFit {
  columns: number;
  /** The root's width at `maxColumns`, the most it grows to. */
  width: number;
}

/**
 * `columns="auto"`: the root is as wide as `maxColumns` need, capped by its
 * max-width, and the columns are the most that fit the width it gets.
 */
function useColumnFit(
  enabled: boolean,
  maxColumns: number,
  groupSize: number,
  rootRef: RefObject<HTMLElement | null>,
  scrollerRef: RefObject<HTMLElement | null>,
  measureRef: RefObject<HTMLElement | null>,
) {
  const [fit, setFit] = useState<ColumnFit | null>(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const scroller = scrollerRef.current;
    const measure = measureRef.current;
    if (!enabled || !root || !scroller || !measure) return;
    const width = (part: string) =>
      measure.querySelector(`[data-measure="${part}"]`)?.getBoundingClientRect()
        .width ?? 0;
    const update = () => {
      const hex = width("hex");
      // happy-dom and a detached tree lay out at 0.
      if (!hex) return;
      const metrics: ColumnMetrics = {
        fixed: width("addr") + width("gap"),
        column: hex + width("text"),
        groupGap: width("group-end") - hex,
        groupSize,
      };
      const style = getComputedStyle(scroller);
      const padding =
        Number.parseFloat(style.paddingLeft) +
        Number.parseFloat(style.paddingRight);
      // The border, the scrollbar gutter and the padding.
      const chrome =
        root.getBoundingClientRect().width - scroller.clientWidth + padding;
      const next = {
        columns: fitColumns(
          scroller.clientWidth - padding,
          maxColumns,
          metrics,
        ),
        width: Math.ceil(rowWidth(maxColumns, metrics) + chrome),
      };
      setFit((prev) =>
        prev?.columns === next.columns && prev.width === next.width
          ? prev
          : next,
      );
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(root);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [enabled, maxColumns, groupSize, rootRef, scrollerRef, measureRef]);
  return enabled ? fit : null;
}

function rangeState(
  cache: PageCache,
  from: number,
  to: number,
): "loading" | "error" {
  const p0 = Math.floor(from / cache.pageSize);
  const p1 = Math.floor(Math.max(from, to - 1) / cache.pageSize);
  for (let p = p0; p <= p1; p++) {
    if (cache.status(p) === "error") return "error";
  }
  return "loading";
}

function isGroupEnd(column: number, columns: number, groupSize: number) {
  return (
    groupSize > 0 && column < columns - 1 && (column + 1) % groupSize === 0
  );
}

// Memoised: the grid re-renders on every scroll frame, and a closed radix
// Select still renders its items to collect their text.
const EncodingPicker = memo(function EncodingPicker({
  value,
  onChange,
}: {
  value: HexEncoding;
  onChange: (encoding: HexEncoding) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as HexEncoding)}
    >
      <SelectTrigger
        size="sm"
        className="orz-hex-encoding"
        aria-label="Text encoding"
      >
        <SelectValue>{encodingLabel(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ENCODING_GROUPS.map(({ group, entries }) => (
          <SelectGroup key={group}>
            <SelectLabel>{group}</SelectLabel>
            {entries.map((info) => (
              <SelectItem key={info.id} value={info.id}>
                {info.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
});

interface HexRowProps {
  rowStart: number;
  length: number;
  /** The cell after the row's last byte is an editor's append cell. */
  append: boolean;
  /** Edited bytes as `from-to` pairs relative to the row start; compared as a string so equal ranges skip the row. */
  modified: string;
  /** The decoder's lookbehind bytes, the row, then its lookahead bytes; `undefined` while not loaded. */
  bytes: Uint8Array | undefined;
  /** How many of `bytes` come before the row. */
  before: number;
  state: "ready" | "loading" | "error";
  /** The state of the whole window the text pane decodes; `bytes` holds only the row's own bytes until it is ready. */
  textState: "ready" | "loading" | "error";
  selFrom: number;
  selTo: number;
  /** The hovered glyph's bytes inside this row, inclusive; -1 when none. */
  hoverFrom: number;
  hoverTo: number;
  caret: number;
  /** The hex digit an editor's caret is on; `undefined` in a plain view. */
  caretNibble: 0 | 1 | undefined;
  columns: number;
  groupSize: number;
  address: string | undefined;
  uppercase: boolean;
  fadeZeroBytes: boolean;
  controlCodes: ControlCodes;
  showText: boolean;
  decoding: TextDecoding;
  /** Repaints every row on a switch, and keys the row's decoded cells. */
  encoding: HexEncoding;
}

const flag = (on: boolean) => (on ? "" : undefined);

function parseModified(modified: string): boolean[] {
  const out: boolean[] = [];
  if (!modified) return out;
  for (const pair of modified.split(",")) {
    const [from, to] = pair.split("-").map(Number) as [number, number];
    for (let i = from; i < to; i++) out[i] = true;
  }
  return out;
}

type GlyphSpan = readonly [lead: number, length: number];

/** Per row byte, the multi-byte glyph it belongs to, for hovering a glyph whole. */
function glyphSpans(cells: readonly TextCell[], rowStart: number) {
  const out: Array<GlyphSpan | undefined> = new Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i] as TextCell;
    if (cell.kind !== "continuation") {
      const length = cell.length ?? 1;
      if (length > 1) out[i] = [rowStart + i, length];
      continue;
    }
    const lead = cell.lead ?? rowStart + i;
    if (lead >= rowStart) {
      out[i] = out[lead - rowStart];
      continue;
    }
    // The lead sits on an earlier row: the glyph ends with its last
    // continuation here.
    let end = i;
    while (
      end + 1 < cells.length &&
      cells[end + 1]?.kind === "continuation" &&
      cells[end + 1]?.lead === lead
    ) {
      end++;
    }
    const span: GlyphSpan = [lead, rowStart + end - lead + 1];
    for (let k = i; k <= end; k++) out[k] = span;
    i = end;
  }
  return out;
}

interface DecodedRow {
  bytes: Uint8Array;
  before: number;
  rowStart: number;
  length: number;
  encoding: HexEncoding;
  controlCodes: ControlCodes;
  cells: TextCell[];
  spans: Array<GlyphSpan | undefined>;
}

/** Decodes once per change of the row's bytes or encoding, not on every selection or hover repaint. */
function useDecodedRow(
  bytes: Uint8Array | undefined,
  row: { rowStart: number; before: number; length: number },
  decoding: TextDecoding,
  encoding: HexEncoding,
  controlCodes: ControlCodes,
): DecodedRow | undefined {
  const last = useRef<DecodedRow | undefined>(undefined);
  if (!bytes) return undefined;
  const prev = last.current;
  if (
    prev &&
    prev.encoding === encoding &&
    prev.controlCodes === controlCodes &&
    prev.rowStart === row.rowStart &&
    prev.before === row.before &&
    prev.length === row.length &&
    sameBytes(prev.bytes, bytes)
  ) {
    return prev;
  }
  const cells = decoding.decodeRow(
    bytes,
    { start: row.rowStart, before: row.before, length: row.length },
    controlCodes,
  );
  const next: DecodedRow = {
    ...row,
    bytes,
    encoding,
    controlCodes,
    cells,
    spans: glyphSpans(cells, row.rowStart),
  };
  last.current = next;
  return next;
}

function HexRowImpl({
  rowStart,
  length,
  append,
  modified,
  bytes,
  before,
  state,
  textState,
  selFrom,
  selTo,
  hoverFrom,
  hoverTo,
  caret,
  caretNibble,
  columns,
  groupSize,
  address,
  uppercase,
  fadeZeroBytes,
  controlCodes,
  showText,
  decoding,
  encoding,
}: HexRowProps) {
  const decoded = useDecodedRow(
    showText && textState === "ready" ? bytes : undefined,
    { rowStart, before, length },
    decoding,
    encoding,
    controlCodes,
  );
  const text = decoded?.cells;
  const edited = parseModified(modified);
  const hexCells = [];
  const textCells = [];
  for (let i = 0; i < columns; i++) {
    const offset = rowStart + i;
    const groupEnd = flag(isGroupEnd(i, columns, groupSize));
    const hov = flag(offset >= hoverFrom && offset <= hoverTo);
    if (append && i === length) {
      const car = offset === caret;
      hexCells.push(
        <span
          key={i}
          className="orz-hex-cell"
          data-offset={offset}
          data-pane="hex"
          data-append=""
          data-hover={hov}
          data-caret={car ? "0" : undefined}
          data-group-end={groupEnd}
        >
          <span className="orz-hex-cell-content" />
        </span>,
      );
      if (showText) {
        textCells.push(
          <span
            key={i}
            className="orz-hex-cell orz-hex-text-cell"
            data-offset={offset}
            data-pane="text"
            data-append=""
            data-hover={hov}
            data-caret={flag(car)}
          >
            <span className="orz-hex-cell-content" />
          </span>,
        );
      }
      continue;
    }
    if (i >= length) {
      hexCells.push(
        <span
          key={i}
          className="orz-hex-cell"
          data-empty=""
          data-group-end={groupEnd}
        >
          <span className="orz-hex-cell-content" />
        </span>,
      );
      if (showText) {
        textCells.push(
          <span
            key={i}
            className="orz-hex-cell orz-hex-text-cell"
            data-empty=""
          >
            <span className="orz-hex-cell-content" />
          </span>,
        );
      }
      continue;
    }
    const sel = flag(selFrom >= 0 && offset >= selFrom && offset <= selTo);
    const car = flag(offset === caret);
    const mod = flag(edited[i] === true);
    const glyph = decoded?.spans[i];
    const byte = bytes?.[before + i];
    const digits =
      byte === undefined
        ? state === "error"
          ? "??"
          : "··"
        : hexByte(byte, uppercase);
    hexCells.push(
      <span
        key={i}
        className="orz-hex-cell"
        data-offset={offset}
        data-pane="hex"
        data-sel={sel}
        data-hover={hov}
        data-caret={car === undefined ? car : (caretNibble ?? "")}
        data-modified={mod}
        data-group-end={groupEnd}
        data-faded={flag(fadeZeroBytes && byte === 0)}
        data-state={byte === undefined ? state : undefined}
        data-glyph={glyph?.[0]}
        data-glyph-length={glyph?.[1]}
      >
        <span className="orz-hex-cell-content">
          {caretNibble === undefined ? (
            digits
          ) : (
            // Two spans, so the caret can sit under the digit typing writes.
            <>
              <span className="orz-hex-nibble">{digits[0]}</span>
              <span className="orz-hex-nibble">{digits[1]}</span>
            </>
          )}
        </span>
      </span>,
    );
    if (!showText) continue;
    const cell = text?.[i];
    let box: { span: number; squeeze: number } | undefined;
    if (cell?.kind === "char" && cell.text) {
      const width = glyphCells(cell.text);
      const glyphLength = cell.length ?? 1;
      if (glyphLength > 1 || width > 1) {
        // A glyph crossing the row end is drawn here only, squeezed into
        // the bytes this row has.
        const span = Math.min(glyphLength, length - i);
        box = { span, squeeze: Math.min(1, span / width) };
      }
    }
    textCells.push(
      <span
        key={i}
        className="orz-hex-cell orz-hex-text-cell"
        data-offset={offset}
        data-pane="text"
        data-sel={sel}
        data-hover={hov}
        data-caret={car}
        data-modified={mod}
        data-kind={cell?.kind}
        data-faded={flag(cell?.kind === "control" || cell?.kind === "dot")}
        data-state={cell ? undefined : textState}
        data-glyph={glyph?.[0]}
        data-glyph-length={glyph?.[1]}
      >
        <span
          className={
            cell?.kind === "control"
              ? "orz-hex-cell-content orz-hex-control"
              : "orz-hex-cell-content"
          }
        >
          {box ? null : cell?.kind === "control" && cell.text ? (
            <>
              <b>{cell.text[0]}</b>
              <b>{cell.text[1]}</b>
            </>
          ) : cell?.kind === "dot" ? (
            "."
          ) : (
            (cell?.text ?? "")
          )}
        </span>
        {box && (
          <span
            className="orz-hex-glyph"
            style={
              {
                "--hex-glyph-span": box.span,
                "--hex-glyph-squeeze": box.squeeze,
              } as CSSProperties
            }
          >
            <span>{cell?.text}</span>
          </span>
        )}
      </span>,
    );
  }
  return (
    <div className="orz-hex-row">
      {address !== undefined && <span className="orz-hex-addr">{address}</span>}
      {hexCells}
      {showText && (
        <>
          <span className="orz-hex-pane-gap" />
          {textCells}
        </>
      )}
    </div>
  );
}

function sameBytes(a: Uint8Array | undefined, b: Uint8Array | undefined) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// A sync source hands out a fresh subarray on every render; equal bytes
// must still skip the row.
const HexRow = memo(HexRowImpl, (prev, next) => {
  for (const key of Object.keys(next) as (keyof HexRowProps)[]) {
    if (key === "bytes") {
      if (!sameBytes(prev.bytes, next.bytes)) return false;
    } else if (prev[key] !== next[key]) {
      return false;
    }
  }
  return true;
});
