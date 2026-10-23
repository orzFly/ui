import {
  clampTopRow,
  scrollFromTopRow,
  scrollGeometry,
  topRowFromScroll,
} from "@orz/ui/lib/scroll-map";
import {
  Fragment,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** Rows mounted beyond each edge of the viewport. */
export const OVERSCAN = 20;

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
}: VirtualRowsProps<L>) {
  const geometry = useMemo(
    () => scrollGeometry(totalRows, rowHeight, viewportHeight),
    [totalRows, rowHeight, viewportHeight],
  );
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  // The top row is kept with the layout it was read in, so a re-wrap keeps
  // the reader on the same line rather than the same row number. Mounted once
  // a streamed log passes the threshold, it keeps the place already scrolled to.
  const [top, setTop] = useState(() => {
    const el = scrollRef.current;
    return { row: el ? topRowFromScroll(el.scrollTop, geometry) : 0, layout };
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
      const next = topRowFromScroll(scrollTop, g);
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
        const scrollTop = scrollFromTopRow(next, g);
        lastWritten.current = scrollTop;
        el.scrollTop = scrollTop;
      }
      if (event.deltaX) el.scrollLeft += event.deltaX * unit;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [geometry.scaled, scrollRef]);

  // A resize, more rows, a re-wrap or a switch between 1:1 and scaled moves
  // the mapping under the top row; the element keeps its old scrollTop.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (topRowFromScroll(el.scrollTop, geometry) === topRow) return;
    const scrollTop = scrollFromTopRow(topRow, geometry);
    lastWritten.current = scrollTop;
    el.scrollTop = scrollTop;
  }, [geometry, topRow, scrollRef]);

  const first = Math.max(0, topRow - OVERSCAN);
  const end = Math.min(totalRows, topRow + geometry.viewportRows + OVERSCAN);
  // 1:1 this is first × rowHeight, so the browser scrolls the rows smoothly;
  // scaled, the top row is pinned to the viewport's top edge.
  const offset =
    scrollFromTopRow(topRow, geometry) - (topRow - first) * rowHeight;

  const rows: ReactNode[] = [];
  for (let row = first; row < end; row++) {
    rows.push(<Fragment key={row}>{renderRow(row)}</Fragment>);
  }
  return (
    <div
      className="relative min-w-full"
      style={{
        height: geometry.spacerHeight,
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
