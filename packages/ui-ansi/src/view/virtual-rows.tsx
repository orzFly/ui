import {
  clampTopRow,
  type ScrollGeometry,
  scrollFromTopRow,
  scrollGeometry,
  topRowFromScroll,
} from "@orz/ui/lib/scroll-map";
import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  type RefObject,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** Rows mounted beyond each edge of the viewport. */
export const OVERSCAN = 20;

/** Scrolling driven from outside, e.g. going to a search match. */
export interface VirtualRowsHandle {
  /** The row at the top of the viewport. */
  topRow(): number;
  /** Scrolls so that `row` sits at the top of the viewport, or mid-way down it. */
  scrollToRow(row: number, align: "top" | "center"): void;
}

export interface VirtualRowsProps<L> {
  /** The element that scrolls; the rows mount inside it. */
  scrollRef: RefObject<HTMLElement | null>;
  totalRows: number;
  rowHeight: number;
  viewportHeight: number;
  /** The rows' layout width; omitted, the scroll container's. */
  width?: number;
  renderRow: (row: number) => ReactNode;
  /** What the rows are laid out by; a new value may move a line to new rows. */
  layout: L;
  /** Where the content at `row` of layout `from` sits in layout `to`. */
  carryRow: (row: number, from: L, to: L) => number;
  /** Empty space above the first row and below the last, in px. */
  padding?: number;
  /** Merged into the spacer's style, e.g. a background drawn along the rows. */
  style?: CSSProperties;
  handle?: RefObject<VirtualRowsHandle | null>;
}

/**
 * `scroll-map` knows only the rows; the padding sits outside them, so the
 * scroll position is shifted by the top padding before it is mapped.
 */
function rowFromScroll(scrollTop: number, g: ScrollGeometry, padding: number) {
  return topRowFromScroll(scrollTop - padding, g);
}

/**
 * The first and last rows map to the very ends, so reaching either shows its
 * padding too.
 */
function scrollFromRow(row: number, g: ScrollGeometry, padding: number) {
  const top = clampTopRow(row, g);
  if (top === 0) return 0;
  const scrollTop = scrollFromTopRow(top, g);
  return top === g.maxTopRow ? scrollTop + 2 * padding : scrollTop + padding;
}

/**
 * Fixed-height rows of which only the visible ones, plus {@link OVERSCAN},
 * are mounted, under a spacer sized by `scroll-map`. Past its pixel cap the
 * scroll position maps to rows proportionally.
 */
export function VirtualRows<L>({
  scrollRef,
  totalRows,
  rowHeight,
  viewportHeight,
  width,
  renderRow,
  layout,
  carryRow,
  padding = 0,
  style,
  handle,
}: VirtualRowsProps<L>) {
  const geometry = useMemo(
    () => scrollGeometry(totalRows, rowHeight, viewportHeight),
    [totalRows, rowHeight, viewportHeight],
  );
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const paddingRef = useRef(padding);
  paddingRef.current = padding;
  // The top row is kept with the layout it was read in, so a re-wrap keeps
  // the reader on the same line rather than the same row number. Mounted once
  // a streamed log passes the threshold, it keeps the place already scrolled to.
  const [top, setTop] = useState(() => {
    const el = scrollRef.current;
    return {
      row: el ? rowFromScroll(el.scrollTop, geometry, padding) : 0,
      layout,
    };
  });
  const topRow = clampTopRow(
    top.layout === layout ? top.row : carryRow(top.row, top.layout, layout),
    geometry,
  );
  const topRowRef = useRef(topRow);
  topRowRef.current = topRow;
  // Scaled, the element's own scrollTop after a write is rounded; a scroll
  // event echoing it must not move the top row again.
  const lastWritten = useRef(-1);
  const wheelRows = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const g = geometryRef.current;
      const scrollTop = el.scrollTop;
      if (g.scaled && Math.abs(scrollTop - lastWritten.current) <= 1) return;
      lastWritten.current = scrollTop;
      const next = rowFromScroll(scrollTop, g, paddingRef.current);
      topRowRef.current = next;
      setTop({ row: next, layout: layoutRef.current });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  // Scaled, one wheel notch would otherwise cross megabytes of rows.
  useEffect(() => {
    const el = scrollRef.current;
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
      if (step) {
        const next = clampTopRow(topRowRef.current + step, g);
        topRowRef.current = next;
        setTop({ row: next, layout: layoutRef.current });
        const scrollTop = scrollFromRow(next, g, paddingRef.current);
        lastWritten.current = scrollTop;
        el.scrollTop = scrollTop;
      }
      if (event.deltaX) el.scrollLeft += event.deltaX * unit;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [geometry.scaled, scrollRef]);

  useImperativeHandle(
    handle,
    () => ({
      topRow: () => topRowRef.current,
      scrollToRow(row, align) {
        const el = scrollRef.current;
        const g = geometryRef.current;
        const next = clampTopRow(
          align === "top" ? row : row - Math.floor((g.viewportRows - 1) / 2),
          g,
        );
        topRowRef.current = next;
        setTop({ row: next, layout: layoutRef.current });
        if (!el) return;
        const scrollTop = scrollFromRow(next, g, paddingRef.current);
        lastWritten.current = scrollTop;
        el.scrollTop = scrollTop;
      },
    }),
    [scrollRef],
  );

  // A resize, more rows, a re-wrap or a switch between 1:1 and scaled moves
  // the mapping under the top row; the element keeps its old scrollTop.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const current = el.scrollTop;
    if (rowFromScroll(current, geometry, padding) === topRow) return;
    // 1:1 the rows never move in the spacer. Left at the old bottom, where
    // the top row sits a padding higher than its mapped place, the view stays
    // put rather than jump when more rows extend the range.
    if (
      !geometry.scaled &&
      Math.abs(current - scrollFromTopRow(topRow, geometry) - 2 * padding) < 1
    ) {
      return;
    }
    const scrollTop = scrollFromRow(topRow, geometry, padding);
    lastWritten.current = scrollTop;
    el.scrollTop = scrollTop;
  }, [geometry, topRow, scrollRef, padding]);

  const first = Math.max(0, topRow - OVERSCAN);
  const end = Math.min(totalRows, topRow + geometry.viewportRows + OVERSCAN);
  // 1:1 this is padding + first × rowHeight, so the browser scrolls the rows
  // smoothly; scaled, the top row is pinned to the viewport's top edge.
  const offset =
    padding + scrollFromTopRow(topRow, geometry) - (topRow - first) * rowHeight;

  const rows: ReactNode[] = [];
  for (let row = first; row < end; row++) {
    rows.push(<Fragment key={row}>{renderRow(row)}</Fragment>);
  }
  return (
    <div
      className="relative min-w-full"
      style={{
        ...style,
        height: geometry.spacerHeight + 2 * padding,
        width,
        // The overscan below the last rows must not extend the scroll range.
        overflowY: "clip",
      }}
    >
      <div
        className="absolute top-0 left-0 w-full"
        style={{ transform: `translateY(${offset}px)` }}
      >
        {rows}
      </div>
    </div>
  );
}
