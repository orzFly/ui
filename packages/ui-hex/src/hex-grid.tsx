import {
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

import {
  addressDigits,
  asciiDecoding,
  controlName,
  copyText,
  formatAddress,
  formatOffset,
  formatSize,
  hexByte,
  MAX_COPY_BYTES,
  type TextDecoding,
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
  /** Bytes per row; 16. */
  columns?: number;
  /** Bytes per group, separated by a gap; 8, and 0 for no gap. */
  groupSize?: number;
  /** Added to every displayed address, never to selection offsets; 0. */
  baseAddress?: number;
  /** A fixed viewport height in rows; omitted, the view fills its parent. */
  rows?: number;
  showAddresses?: boolean;
  showColumnLabels?: boolean;
  /** The text pane beside the hex pane. */
  showText?: boolean;
  showStatusBar?: boolean;
  uppercase?: boolean;
  fadeZeroBytes?: boolean;
  controlCodes?: ControlCodes;
  onCopy?: (result: HexCopyResult) => void;
  onReadError?: (error: unknown, offset: number) => void;
  ref?: Ref<HexViewHandle>;
  className?: string;
  "aria-label"?: string;
}

/** What the grid hands an editor: the pieces of the view its commands drive. */
export interface GridContext {
  cache: PageCache;
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
export function useControllableSelection(
  value: HexSelection | null | undefined,
  defaultValue: HexSelection | null | undefined,
  onChange: ((selection: HexSelection | null) => void) | undefined,
) {
  const [inner, setInner] = useState(defaultValue ?? null);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const currentRef = useLatest(current);
  const onChangeRef = useLatest(onChange);
  const set = useCallback(
    (next: HexSelection | null) => {
      if (sameSelection(currentRef.current, next)) return;
      if (!controlled) {
        // Later calls in the same event see this one before the re-render.
        currentRef.current = next;
        setInner(next);
      }
      onChangeRef.current?.(next);
    },
    [controlled, currentRef, onChangeRef],
  );
  return [current, set, currentRef] as const;
}

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

function hitFromElement(el: Element | null, grid: Element): Hit | null {
  const cell = el?.closest?.("[data-offset]");
  if (!cell || !grid.contains(cell)) return null;
  const offset = Number(cell.getAttribute("data-offset"));
  const pane = cell.getAttribute("data-pane") === "text" ? "text" : "hex";
  return Number.isFinite(offset) ? { offset, pane } : null;
}

export function HexGrid({
  source,
  selection: selectionProp,
  defaultSelection,
  onSelectionChange,
  columns = 16,
  groupSize = 8,
  baseAddress = 0,
  rows,
  showAddresses = true,
  showColumnLabels = true,
  showText = true,
  showStatusBar = true,
  uppercase = true,
  fadeZeroBytes = true,
  controlCodes = "abbreviations",
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
  const decoding: TextDecoding = asciiDecoding;

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
  const liveRef = useRef<HTMLDivElement>(null);

  const rowHeight =
    useElementSize(probeRef, (el) => el.getBoundingClientRect().height) ||
    FALLBACK_ROW_HEIGHT;
  const headerHeight = showColumnLabels ? rowHeight : 0;
  const scrollerHeight = useElementSize(scrollerRef, (el) => el.clientHeight);
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
  const topRow = clampTopRow(topRowState, geometry);
  const topRowRef = useLatest(topRow);
  const lastWritten = useRef(-1);

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
            ? g.viewportHeight
            : 1;
      setTop(topRowRef.current + (event.deltaY * unit) / g.rowHeight);
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
    const scrollTop = scrollFromTopRow(topRowRef.current, geometry);
    if (Math.abs(el.scrollTop - scrollTop) > 1) {
      lastWritten.current = scrollTop;
      el.scrollTop = scrollTop;
    }
  }, [geometry, topRowRef]);

  const visibleCount = Math.ceil(viewportHeight / rowHeight) + 1;
  const firstRow = Math.floor(topRow);
  const lastRow = Math.min(totalRows - 1, firstRow + visibleCount - 1);
  const layerTop =
    scrollFromTopRow(topRow, geometry) - (topRow - firstRow) * rowHeight;

  const lookbehind = decoding.lookbehind;
  const firstPage = Math.floor(
    Math.max(0, firstRow * columns - lookbehind) / cache.pageSize,
  );
  const lastPage = Math.floor(
    Math.max(0, Math.min(size, (lastRow + 1) * columns) - 1) / cache.pageSize,
  );
  const hasRows = lastRow >= firstRow;
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
      const visibleRows = g.viewportHeight / g.rowHeight;
      const top = topRowRef.current;
      if (align === "start") setTop(row);
      else if (align === "center") setTop(row - (visibleRows - 1) / 2);
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

  const [hover, setHover] = useState(-1);
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
    const bottom = top + geometryRef.current.viewportHeight;
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
        const glyph =
          byte >= 0x20 && byte < 0x7f
            ? String.fromCharCode(byte)
            : controlName(byte);
        text += `: ${hexByte(byte, uppercase)}${glyph ? ` (${glyph})` : ""}`;
      }
      live.textContent = text;
    },
    [baseAddress, cache, uppercase],
  );

  // The one place keys are handled; editing hooks its input in here.
  const handleKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (editing?.onKey(event, context)) return;
    const current = selectionRef.current;
    const g = geometryRef.current;
    const pageRows = Math.max(1, Math.floor(g.viewportHeight / g.rowHeight));
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
        firstVisible: Math.min(
          maxOffset,
          Math.ceil(topRowRef.current) * columns,
        ),
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
      const lead = Math.min(decoding.lookbehind, start);
      const text = (bytes: Uint8Array) =>
        copyText(bytes, sel.pane, uppercase, decoding, lead, start);
      const bytes = cache.get(start - lead, length + lead);
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
      cache.readRange(start - lead, length + lead).then(
        (read) =>
          clipboard.writeText(text(read)).then(
            () => report({ ok: true, bytes: length }),
            () => report({ ok: false, reason: "clipboard-unavailable" }),
          ),
        () => report({ ok: false, reason: "read-failed" }),
      );
    },
    [cache, onCopyRef, selectionRef, source, uppercase],
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

  // Chromium fires `copy` at the body, not at a focused non-editable element,
  // when nothing is selected in the document; listening on the document
  // catches both, and the menu's Copy too. Cut and paste arrive the same way.
  useEffect(() => {
    const ours = (event: ClipboardEvent) => {
      const root = rootRef.current;
      if (!root || event.defaultPrevented) return false;
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

  const rowElements = [];
  for (let row = firstRow; row <= lastRow; row++) {
    const rowStart = row * columns;
    const length = Math.min(columns, size - rowStart);
    const before = Math.min(lookbehind, rowStart);
    // A copy: a sync source may change its buffer in place, and the row's
    // memo compares the bytes it last rendered with these.
    const bytes = cache.get(rowStart - before, length + before)?.slice();
    let state: "ready" | "loading" | "error" = "ready";
    if (!bytes) {
      const p0 = Math.floor((rowStart - before) / cache.pageSize);
      const p1 = Math.floor((rowStart + length - 1) / cache.pageSize);
      state = "loading";
      for (let p = p0; p <= p1; p++) {
        if (cache.status(p) === "error") state = "error";
      }
    }
    const rowEnd = rowStart + length - 1;
    const append = appendCell && size - rowStart < columns;
    const cellEnd = append ? rowEnd + 1 : rowEnd;
    const inSel = selStart <= rowEnd && selLast >= rowStart && selStart >= 0;
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
        state={state}
        selFrom={inSel ? Math.max(selStart, rowStart) : -1}
        selTo={inSel ? Math.min(selLast, rowEnd) : -1}
        hover={hover >= rowStart && hover <= cellEnd ? hover : -1}
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
      />,
    );
  }

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
      data-active-pane={selection?.pane ?? "hex"}
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
      <div
        ref={scrollerRef}
        className="orz-hex-scroller"
        style={
          rows === undefined
            ? undefined
            : {
                height: `calc(var(--hex-row-height) * ${rows + (showColumnLabels ? 1 : 0)})`,
              }
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
          <div className="orz-hex-row orz-hex-header" aria-hidden>
            {showAddresses && (
              <span className="orz-hex-addr" style={{ width: `${digits}ch` }} />
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
            {showText && (
              <>
                <span className="orz-hex-pane-gap" />
                <span
                  className="orz-hex-text-label"
                  style={{ width: `calc(var(--hex-text-cell) * ${columns})` }}
                >
                  Text
                </span>
              </>
            )}
          </div>
        )}
        <div
          className="orz-hex-spacer"
          style={{ height: `${geometry.spacerHeight}px` }}
        >
          <div
            className="orz-hex-layer"
            style={{ transform: `translateY(${layerTop}px)` }}
          >
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

function isGroupEnd(column: number, columns: number, groupSize: number) {
  return (
    groupSize > 0 && column < columns - 1 && (column + 1) % groupSize === 0
  );
}

interface HexRowProps {
  rowStart: number;
  length: number;
  /** The cell after the row's last byte is an editor's append cell. */
  append: boolean;
  /** Edited bytes as `from-to` pairs relative to the row start; compared as a string so equal ranges skip the row. */
  modified: string;
  /** The decoder's lookbehind bytes, then the row; `undefined` while not loaded. */
  bytes: Uint8Array | undefined;
  state: "ready" | "loading" | "error";
  selFrom: number;
  selTo: number;
  hover: number;
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

function HexRowImpl({
  rowStart,
  length,
  append,
  modified,
  bytes,
  state,
  selFrom,
  selTo,
  hover,
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
}: HexRowProps) {
  const lead = bytes ? bytes.length - length : 0;
  const text =
    bytes && showText
      ? decoding.decodeRow(bytes, rowStart, controlCodes).slice(0, length)
      : undefined;
  const edited = parseModified(modified);
  const hexCells = [];
  const textCells = [];
  for (let i = 0; i < columns; i++) {
    const offset = rowStart + i;
    const groupEnd = flag(isGroupEnd(i, columns, groupSize));
    if (append && i === length) {
      const car = offset === caret;
      const hov = flag(offset === hover);
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
    const hov = flag(offset === hover);
    const car = flag(offset === caret);
    const mod = flag(edited[i] === true);
    const byte = bytes?.[lead + i];
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
        data-state={cell ? undefined : state}
      >
        <span
          className={
            cell?.kind === "control"
              ? "orz-hex-cell-content orz-hex-control"
              : "orz-hex-cell-content"
          }
        >
          {cell?.kind === "control" && cell.text ? (
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
