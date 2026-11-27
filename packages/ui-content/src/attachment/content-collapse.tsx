import { cn } from "@orz/ui/lib/utils";
import { ChevronDownIcon, ChevronUpIcon, Maximize2Icon } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useViewerImage } from "./viewer-image.ts";

// The cut: 20 lines of pierre's 20px and its 8px above and below, or half the
// screen where that is shorter. A body less than half as tall again is drawn
// whole, since a bar to show a few lines more costs about what they do. The
// classes are literal, for Tailwind to find; MEASURING is the threshold,
// cutting a body while it is first measured.
const CAP_PX = 416;
const CUT = "max-h-[min(416px,50vh)]";
const MEASURING = "max-h-[min(624px,75vh)]";

function threshold(): number {
  return 1.5 * Math.min(CAP_PX, window.innerHeight / 2);
}

type Collapse = {
  collapse: boolean | "measure";
  /** Undefined in the viewer, where the bar expands in place instead. */
  onOpen: (() => void) | undefined;
  lines: number | undefined;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
};

const CollapseContext = createContext<Collapse | null>(null);

export type ContentCollapseProps = {
  /**
   * `true`: collapsed from the first frame, for a length known up front (a fence's line count).
   * `"measure"`: collapsed once the body proves taller than 1.5 times the cap, measured again as
   * it or the window changes. `false`: never, and `useContentCollapse` answers null inside.
   */
  collapse: boolean | "measure";
  /**
   * Opens the whole content elsewhere, the attachment viewer. Given, the bar opens it rather than
   * expanding in place; inside the viewer it is ignored and the bar expands in place.
   */
  onOpen?: () => void;
  /** The content's line count, which a bar that expands in place names. */
  lines?: number;
  children: ReactNode;
};

/**
 * Holds whether a long block is cut at the cap, and what its bar does, for the header and body
 * inside it. Draws nothing; `ContentCollapseBody` is the cut box and its bar.
 */
export function ContentCollapse({
  collapse,
  onOpen,
  lines,
  children,
}: ContentCollapseProps) {
  const [expanded, setExpanded] = useState(false);
  // Already in the viewer, the block is what the viewer would show.
  const inViewer = useViewerImage() !== null;
  const open = inViewer ? undefined : onOpen;
  const value = useMemo(
    () => ({ collapse, onOpen: open, lines, expanded, setExpanded }),
    [collapse, open, lines, expanded],
  );
  return (
    <CollapseContext.Provider value={value}>
      {children}
    </CollapseContext.Provider>
  );
}

/**
 * Whether the block around was expanded in place; null outside a `ContentCollapse`, or in one
 * that never collapses. A virtualized view picks its box by it.
 */
export function useContentCollapse(): { expanded: boolean } | null {
  const state = useContext(CollapseContext);
  const expanded = state?.expanded ?? false;
  const on = state !== null && state.collapse !== false;
  return useMemo(() => (on ? { expanded } : null), [on, expanded]);
}

/** The element a shift of the page is taken up by: the nearest ancestor that scrolls. */
function scrollPage(from: HTMLElement, by: number) {
  if (by === 0) return;
  for (let el = from.parentElement; el !== null; el = el.parentElement) {
    if (el === document.body || el === document.documentElement) break;
    const { overflowY } = getComputedStyle(el);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight
    ) {
      el.scrollTop += by;
      return;
    }
  }
  window.scrollBy(0, by);
}

type Shift =
  /** Show less: the bar's top before, which it is put back at. */
  | { kind: "back"; top: number }
  /** Expanded by a scroll of the cut box: how far it had scrolled. */
  | { kind: "down"; by: number };

/**
 * The body of a `ContentCollapse`: cut at `min(416px, 50vh)` with a fade and a bar that shows all
 * of it, in place or in the viewer. Past the cut the content stays in the DOM.
 */
export function ContentCollapseBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const state = useContext(CollapseContext);
  const collapse = state?.collapse ?? false;
  const expanded = state?.expanded ?? false;
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLButtonElement>(null);
  const id = useId();
  // Null until measured. A count known up front is tall from the first frame,
  // so a prerendered page does not jump.
  const [tallByMeasure, setTall] = useState<boolean | null>(null);
  const tall = collapse === true || (collapse === "measure" && tallByMeasure);
  const shift = useRef<Shift | null>(null);

  // Not while expanded: the body may then be drawn in a shorter box than it
  // was cut from (a patch's 70vh scroller), and measured there its bar would
  // go. Measured again on the way back.
  useLayoutEffect(() => {
    if (collapse !== "measure" || expanded) return;
    const el = inner.current;
    if (el === null) return;
    const check = () => setTall(el.offsetHeight > threshold());
    check();
    window.addEventListener("resize", check);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(check);
    observer?.observe(el);
    return () => {
      window.removeEventListener("resize", check);
      observer?.disconnect();
    };
  }, [collapse, expanded]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on the commit that expanded or cut the body, whose layout the shift is measured against
  useLayoutEffect(() => {
    const move = shift.current;
    shift.current = null;
    if (move === null || box.current === null) return;
    if (move.kind === "down") {
      scrollPage(box.current, move.by);
    } else if (bar.current !== null) {
      scrollPage(
        box.current,
        bar.current.getBoundingClientRect().top - move.top,
      );
    }
  }, [expanded]);

  if (state === null || collapse === false) return children;

  const opens = state.onOpen !== undefined;
  const cut = tall && !(expanded && !opens);
  const lines = state.lines;
  return (
    <>
      <div
        data-slot="content-collapse"
        className={cn(cut && "relative", className)}
      >
        <div
          ref={box}
          id={id}
          data-cut={cut ? "" : undefined}
          className={cn(
            "print:max-h-none print:overflow-visible",
            cut
              ? `${CUT} overflow-hidden`
              : tallByMeasure === null &&
                  collapse === "measure" &&
                  `${MEASURING} overflow-hidden`,
          )}
          onScroll={
            cut && !opens
              ? (event) => {
                  // Tab, find in page or an anchor scrolled the cut box to
                  // something past the cut: show it all, and keep that thing
                  // where it was on screen.
                  const by = event.currentTarget.scrollTop;
                  if (by <= 0) return;
                  shift.current = { kind: "down", by };
                  state.setExpanded(true);
                }
              : undefined
          }
        >
          <div ref={inner}>{children}</div>
        </div>
        {cut && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-b from-transparent to-background print:hidden raymond:hidden"
          />
        )}
      </div>
      {tall && (
        <button
          ref={bar}
          type="button"
          data-slot="content-collapse-bar"
          aria-controls={opens ? undefined : id}
          aria-expanded={opens ? undefined : expanded}
          aria-haspopup={opens ? "dialog" : undefined}
          onClick={() => {
            if (opens) {
              state.onOpen?.();
              return;
            }
            if (expanded && bar.current !== null) {
              shift.current = {
                kind: "back",
                top: bar.current.getBoundingClientRect().top,
              };
            }
            state.setExpanded(!expanded);
          }}
          // The strip a card's footer is, under the cut; under raymond a band
          // of the face, raised and sunk as a flat toolbar button is.
          className="flex min-h-row w-full cursor-pointer items-center gap-1.5 border-t bg-muted px-2 text-left text-ui-sm text-muted-foreground outline-none select-none hover:text-foreground focus-visible:focus-ring-inset touch:min-h-touch print:hidden raymond:border-t-0 raymond:bg-(--3d-face) raymond:text-foreground raymond:hover:shadow-[inset_1px_1px_var(--3d-highlight),inset_-1px_-1px_var(--3d-shadow)] raymond:active:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)] [&_svg]:size-3.5 [&_svg]:shrink-0"
        >
          {opens ? (
            <>
              <Maximize2Icon />
              Show all
            </>
          ) : expanded ? (
            <>
              <ChevronUpIcon />
              Show less
            </>
          ) : (
            <>
              <ChevronDownIcon />
              {lines === undefined
                ? "Show all"
                : `Show all ${lines.toLocaleString("en-US")} lines`}
            </>
          )}
        </button>
      )}
    </>
  );
}
