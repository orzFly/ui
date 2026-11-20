import * as React from "react";
import { createPortal } from "react-dom";

import { POINTER_FINE } from "../hooks/use-media-query.ts";
import { cn } from "../lib/utils.ts";
import { Pane } from "./pane.tsx";

/** Marks the action's own box, so a press on it is not a new selection. */
const OWN = "data-selection-action";

/** How long a touch press on the action may hold on to a selection it collapsed. */
const PRESS_MS = 300;

/** The gap between the selection's last line and the action under it. */
const GAP = 6;

type Region = { value: () => unknown };

const RegionsContext = React.createContext<Map<Element, Region> | null>(null);

/** The text selected inside one region, which a `SelectionAction`'s children act on. */
export type TextSelection<T> = {
  /** The selected text, as `Selection.toString()` gives it. */
  text: string;
  range: Range;
  /** The value the region was registered with. */
  value: T;
  /** The region's element. */
  region: Element;
  /** Clears the selection, and with it the action. */
  dismiss: () => void;
};

/**
 * Holds the regions a selection may be acted on in, for the `SelectionAction` inside it. Mount
 * one around the regions and the action, a page or a timeline.
 */
function SelectionActionProvider({ children }: { children: React.ReactNode }) {
  const [regions] = React.useState(() => new Map<Element, Region>());
  return <RegionsContext value={regions}>{children}</RegionsContext>;
}

/**
 * Registers the element the returned ref lands on as a region: text selected wholly inside it
 * brings up the `SelectionAction`, with `value` (a comment, say) for its children. A callback
 * ref, so a region that comes and goes while its owner stays mounted (a body swapped for an
 * editor) comes and goes with it.
 */
function useSelectionRegion<T>(value: T): (element: Element | null) => void {
  const regions = React.useContext(RegionsContext);
  const latest = React.useRef(value);
  React.useLayoutEffect(() => {
    latest.current = value;
  });
  const registered = React.useRef<Element | null>(null);
  return React.useCallback(
    (element: Element | null) => {
      if (!regions) return;
      if (registered.current) regions.delete(registered.current);
      registered.current = element;
      if (element) regions.set(element, { value: () => latest.current });
    },
    [regions],
  );
}

/** The region both ends of `range` sit in, or null: a selection that runs out of one acts on none. */
function regionOf(regions: Map<Element, Region>, range: Range) {
  const start = range.startContainer;
  for (
    let el: Element | null =
      start instanceof Element ? start : start.parentElement;
    el !== null;
    el = el.parentElement
  ) {
    const region = regions.get(el);
    if (region === undefined) continue;
    return el.contains(range.endContainer) ? { el, region } : null;
  }
  return null;
}

type Shown = {
  text: string;
  range: Range;
  value: unknown;
  region: Element;
  /** Viewport coordinates of the action's top right corner; null for the bar on touch. */
  at: { top: number; right: number } | null;
};

/**
 * An action over text the reader selected inside one region (`useSelectionRegion`): a Quote
 * reply, a Comment, a Copy link to here. With a mouse it floats under the selection's last line
 * at the region's right edge; on touch, where the platform's own bubble floats against the
 * selection, it is a bar along the window's foot. It stays away while a drag is still selecting,
 * and when the selection runs out of its region or across two. A press on it keeps the selection
 * it would collapse, so the action still has it.
 *
 * `children` draws the action from the selection: a `Button`, or several. It is the only way to
 * the action for a pointer; give it another way too (a row's menu), as a keyboard user selecting
 * text has no pointer to reach it with.
 */
function SelectionAction<T>({
  children,
  className,
}: {
  children: (selection: TextSelection<T>) => React.ReactNode;
  className?: string;
}) {
  const regions = React.useContext(RegionsContext);
  const [shown, setShown] = React.useState<Shown | null>(null);
  const shownRef = React.useRef(shown);
  shownRef.current = shown;
  const dragging = React.useRef(false);
  const pressingOwn = React.useRef(false);

  const decide = React.useCallback(
    (keepOnEmpty = false) => {
      if (!regions) return;
      const selection = window.getSelection();
      if (
        selection === null ||
        selection.rangeCount === 0 ||
        selection.toString() === ""
      ) {
        if (!keepOnEmpty && !pressingOwn.current) setShown(null);
        return;
      }
      // Mid-drag the action would sit under the words still being selected;
      // the release reads the selection again.
      if (dragging.current) return;
      const range = selection.getRangeAt(0);
      const found = regionOf(regions, range);
      if (found === null) {
        setShown(null);
        return;
      }
      const fine =
        typeof window.matchMedia !== "function" ||
        window.matchMedia(POINTER_FINE).matches;
      const rect = range.getBoundingClientRect();
      const frame = found.el.getBoundingClientRect();
      setShown({
        text: selection.toString(),
        range,
        value: found.region.value(),
        region: found.el,
        at: fine
          ? {
              // Never below the region: a selection ending on a block's last
              // character can report the empty line after it.
              top: Math.min(rect.bottom, frame.bottom) + GAP,
              right: frame.right,
            }
          : null,
      });
    },
    [regions],
  );

  // Every way a selection changes: the keyboard, a drag released anywhere,
  // a touch's long press.
  React.useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let frame: number | null = null;
    let pressTimer: number | null = null;
    const schedule = (keepOnEmpty = false) => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        decide(keepOnEmpty);
      });
    };
    const endPress = () => {
      pressingOwn.current = false;
      if (pressTimer !== null) {
        window.clearTimeout(pressTimer);
        pressTimer = null;
      }
    };
    // What the press held back is "the selection is gone", so its end reads
    // the selection again.
    const releaseOwn = () => {
      endPress();
      schedule();
    };
    document.addEventListener("selectionchange", () => schedule(), { signal });
    document.addEventListener(
      "pointerdown",
      (event) => {
        const own =
          event.target instanceof Element &&
          event.target.closest(`[${OWN}]`) !== null;
        if (!own) {
          dragging.current = true;
          return;
        }
        pressingOwn.current = true;
        // A press that slides off the action fires neither a click nor a
        // pointercancel, and must not leave a dead action on screen.
        pressTimer = window.setTimeout(releaseOwn, PRESS_MS);
      },
      { capture: true, signal },
    );
    document.addEventListener(
      "pointerup",
      () => {
        dragging.current = false;
        schedule();
      },
      { signal },
    );
    document.addEventListener(
      "pointercancel",
      () => {
        dragging.current = false;
        releaseOwn();
      },
      { signal },
    );
    document.addEventListener("click", releaseOwn, { signal });
    // Measured against a layout that a resize or a scroll has moved; with no
    // selection left to measure, it stays where it is.
    const follow = () => {
      if (shownRef.current?.at) schedule(true);
    };
    window.addEventListener("resize", follow, { signal });
    document.addEventListener("scroll", follow, {
      capture: true,
      passive: true,
      signal,
    });
    return () => {
      controller.abort();
      if (frame !== null) cancelAnimationFrame(frame);
      endPress();
    };
  }, [decide]);

  if (shown === null) return null;

  const dismiss = () => {
    setShown(null);
    window.getSelection()?.removeAllRanges();
  };
  const content = children({
    text: shown.text,
    range: shown.range,
    value: shown.value as T,
    region: shown.region,
    dismiss,
  });
  const keep = {
    [OWN]: "",
    // A mouse press would collapse the selection before the click lands; a
    // touch press is left to the press window above.
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType === "mouse") event.preventDefault();
    },
    onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
  };

  return createPortal(
    shown.at ? (
      <div
        {...keep}
        data-slot="selection-action"
        className={cn(
          "fixed z-50 flex -translate-x-full gap-1 *:shadow-overlay",
          className,
        )}
        style={{ top: shown.at.top, left: shown.at.right }}
      >
        {content}
      </div>
    ) : (
      <Pane
        {...keep}
        purpose="toolbar"
        edge="top"
        data-slot="selection-action"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex gap-2 bg-background/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur *:flex-1",
          className,
        )}
      >
        {content}
      </Pane>
    ),
    document.body,
  );
}

export { SelectionAction, SelectionActionProvider, useSelectionRegion };
