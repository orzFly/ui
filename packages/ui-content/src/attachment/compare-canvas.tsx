import { Slider } from "@orz/ui/components/slider";
import { cn } from "@orz/ui/lib/utils";
import {
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { COMPARE_MODES, type CompareMode } from "../compare/compare-mode.tsx";
import {
  CompareLabel,
  CompareModes,
  type CompareSide,
  STRIP,
  SwipeHandle,
} from "../compare/media-compare.tsx";
import type { ImageLook } from "./image-look.ts";
import {
  fitScale,
  type Pane,
  sideBySidePanes,
  type View,
} from "./image-zoom.ts";
import { releaseWidth, useZoomPan, type Widening } from "./use-zoom-pan.ts";
import type { FileSource } from "./viewer.tsx";
import { CHECKER, CORNER } from "./zoom-canvas.tsx";
import { ZoomControls } from "./zoom-controls.tsx";

/** One side of a comparison the viewer shows. */
export type CompareItem = {
  /** The side's tag, such as "v2". */
  label: string;
  /** Natural size, already measured where the comparison was drawn. */
  size: { width: number; height: number };
  /** The image, drawn as an `<img>` and offered for download. */
  file?: FileSource;
  /** Drawn in place of `file`'s image, at `size`: an SVG, say, zoomed as vectors. */
  content?: ReactNode;
};

/** Two versions the viewer shows at one zoom and one position. */
export type ComparePair = {
  before: CompareItem;
  after: CompareItem;
  /** The title bar's. Default: the files' names. */
  title?: string;
  /** Under the comparison's bar. Default: each side's type, size and download. */
  footer?: ReactNode;
  /**
   * The modes offered. Default: all four for two images, side by side alone
   * when a side is drawn `content`, which then always sits left and right.
   */
  modes?: readonly CompareMode[];
};

/** Whether a side is drawn content rather than an image file. */
const drawn = (pair: ComparePair) =>
  pair.before.content !== undefined || pair.after.content !== undefined;

/** The modes a pair offers. */
export function pairModes(pair: ComparePair): readonly CompareMode[] {
  return pair.modes ?? (drawn(pair) ? ["2up"] : COMPARE_MODES);
}

/** The mode a pair is drawn in: the chosen one, when the pair offers it. */
export function pairMode(pair: ComparePair, chosen: CompareMode): CompareMode {
  return pairModes(pair).includes(chosen) ? chosen : "2up";
}

/** A pair's title-bar name. */
export function pairTitle(pair: ComparePair): string {
  if (pair.title !== undefined) return pair.title;
  const before = pair.before.file?.name;
  const after = pair.after.file?.name;
  if (before === undefined || after === undefined)
    return after ?? before ?? "Comparison";
  return before === after ? after : `${before} → ${after}`;
}

const GAP = 8;

// Pressed with the keyboard's focus in one, these move it; the viewer pages
// on the arrow keys only from elsewhere.
const SLIDER_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);
function keepSliderKeys(e: { key: string; stopPropagation(): void }) {
  if (SLIDER_KEYS.has(e.key)) e.stopPropagation();
}

function useWindowHeight() {
  const [height, setHeight] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerHeight,
  );
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return height;
}

type Hover = { pane: number; x: number; y: number };

/**
 * Two versions of a picture in the attachment viewer, drawn as one view: one
 * zoom and one position for both, from the union of their sizes with their
 * top-left corners together, so wherever either is zoomed or dragged the
 * other follows. Side by side cuts the canvas into two panes showing that
 * same view, left and right or one above the other, whichever draws the
 * pictures larger; the overlay modes stack both in one. Mount it keyed by
 * the pair, as ImageCanvas is by its image.
 */
export function CompareCanvas({
  pair,
  mode,
  maximized,
  toolbar,
  look,
  onLookChange,
  lastHeight,
  held,
  dialog,
  widening,
  cut,
  onCut,
  fade,
}: {
  pair: ComparePair;
  /** The pair's mode, from `pairMode`. */
  mode: CompareMode;
  maximized: boolean;
  toolbar: HTMLElement | null;
  look: ImageLook;
  onLookChange(look: ImageLook): void;
  lastHeight: { current: number | null };
  held: number | null;
  dialog: HTMLElement | null;
  widening: { current: Widening };
  /** Swipe's split, in percent of the canvas width. */
  cut: number;
  onCut(cut: number): void;
  /** Onion skin's opacity of the after side, in percent. */
  fade: number;
}) {
  const isDrawn = drawn(pair);
  const twoUp = mode === "2up";
  const [failed, setFailed] = useState(false);
  const { before, after } = pair;
  const natural = useMemo(
    () =>
      failed
        ? null
        : {
            w: Math.max(before.size.width, after.size.width),
            h: Math.max(before.size.height, after.size.height),
          },
    [failed, before.size, after.size],
  );
  const windowHeight = useWindowHeight();
  // Memoised: a new callback measures the canvas again.
  const panes = useCallback(
    (width: number, height: number, rest: number): Pane[] => {
      if (!twoUp || natural === null) return [{ x: 0, y: 0, width, height }];
      // The arrangement is chosen against the tallest the canvas may get and
      // the width it rests at, so it does not flip while a restored canvas
      // grows with the zoom; the panes then split the canvas at the size it
      // has now. A drawing sits left and right whatever its shape: the two
      // read against each other.
      const cap = maximized ? height : windowHeight * 0.75;
      const direction = isDrawn
        ? "row"
        : sideBySidePanes(
            rest,
            cap,
            { width: natural.w, height: natural.h },
            maximized,
            GAP,
          ).direction;
      if (direction === "row") {
        const w = (width - GAP) / 2;
        return [
          { x: 0, y: 0, width: w, height },
          { x: w + GAP, y: 0, width: w, height },
        ];
      }
      const h = (height - GAP) / 2;
      return [
        { x: 0, y: 0, width, height: h },
        { x: 0, y: h + GAP, width, height: h },
      ];
    },
    [twoUp, isDrawn, natural, maximized, windowHeight],
  );
  const zoom = useZoomPan({
    natural,
    panes,
    maximized,
    lastHeight,
    held,
    dialog,
    widening,
  });
  const { frame, view, fitted, dragging, height, handlers } = zoom;

  // Only a mouse has a pointer resting somewhere to mark.
  const [hover, setHover] = useState<Hover | null>(null);
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    handlers.onPointerMove(e);
    if (e.pointerType !== "mouse" || !twoUp || zoom.panes === null) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const pane = zoom.panes.findIndex(
      (p) => x >= p.x && x < p.x + p.width && y >= p.y && y < p.y + p.height,
    );
    const box = zoom.panes[pane];
    setHover(box === undefined ? null : { pane, x: x - box.x, y: y - box.y });
  };

  // Swipe's split stays where it is on screen; only the grip moves it, and a
  // drag anywhere else pans the pictures under it.
  const [cutting, setCutting] = useState(false);
  const dragCut = (e: ReactPointerEvent<HTMLElement>) => {
    const canvas = zoom.canvasRef.current;
    if (canvas === null) return;
    const r = canvas.getBoundingClientRect();
    if (r.width === 0) return;
    onCut(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
  };

  const controls =
    toolbar === null
      ? null
      : createPortal(
          <ZoomControls
            frame={failed ? null : frame}
            view={view}
            atCentre={zoom.atCentre}
            step={zoom.step}
            look={isDrawn ? undefined : look}
            onLookChange={onLookChange}
          />,
          toolbar,
        );

  const onError = () => {
    lastHeight.current = null;
    releaseWidth(dialog, widening);
    setFailed(true);
  };

  // Nothing to measure or zoom: both images as the browser draws them, its
  // broken-image icon and alt text being the error.
  if (failed) {
    return (
      <>
        {controls}
        <div
          data-testid="compare-canvas"
          className="flex flex-col items-center gap-2"
        >
          {[before, after].map((side) => (
            <img
              key={side.label}
              src={side.file?.url}
              alt={`${side.label}: ${side.file?.name ?? ""}`}
              className={cn(
                "rounded-item object-contain",
                maximized
                  ? "max-h-[50%]"
                  : "max-h-[calc(var(--attachment-pane-height)/2)]",
              )}
            />
          ))}
        </div>
      </>
    );
  }

  const checkered = !isDrawn && look.background === "checker";
  const picture = (side: CompareItem, round: boolean) => (
    <Placed
      side={side}
      view={view}
      round={round && fitted}
      pixelated={look.smoothing === "pixelated"}
      onError={onError}
    />
  );
  const checker = (size: { width: number; height: number }, round: boolean) =>
    checkered &&
    view !== null && (
      // In screen pixels like ImageCanvas's, under the picture only.
      <div
        aria-hidden
        className="absolute"
        style={{
          left: view.x,
          top: view.y,
          width: size.width * view.z,
          height: size.height * view.z,
          background: CHECKER,
          borderRadius: round && fitted ? CORNER : 0,
        }}
      />
    );
  const cutPanes = twoUp ? (zoom.panes ?? []) : [];
  const second =
    cutPanes.length > 1 ? cutPanes[cutPanes.length - 1] : undefined;
  const layer = "absolute inset-0";

  return (
    <>
      {controls}
      <div
        ref={zoom.canvasRef}
        data-testid="compare-canvas"
        data-mode={mode}
        data-zoom={view === null ? undefined : view.z.toFixed(4)}
        data-fit={frame === null ? undefined : fitScale(frame).toFixed(4)}
        data-direction={
          second === undefined ? undefined : second.y > 0 ? "column" : "row"
        }
        className={cn(
          "group/stage relative touch-none overflow-hidden select-none",
          ((!isDrawn && look.background === "black") || mode === "diff") &&
            "bg-black",
          maximized ? "h-full" : "max-h-(--attachment-pane-height) min-h-24",
          fitted
            ? "cursor-zoom-in"
            : dragging
              ? "cursor-grabbing"
              : "cursor-grab",
        )}
        style={{ height, "--cut": `${cut}%` } as CSSProperties}
        {...handlers}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
      >
        {twoUp
          ? cutPanes.map((pane, i) => {
              const which = i === 0 ? "before" : "after";
              return (
                <div
                  key={which}
                  data-slot="compare-pane"
                  data-side={which}
                  className={cn(
                    "absolute overflow-hidden before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-2 before:h-0.5 before:content-['']",
                    STRIP[which],
                  )}
                  style={{
                    left: pane.x,
                    top: pane.y,
                    width: pane.width,
                    height: pane.height,
                  }}
                >
                  {checker(pair[which].size, true)}
                  {picture(pair[which], true)}
                  {hover !== null && hover.pane !== i && (
                    <Crosshair x={hover.x} y={hover.y} />
                  )}
                </div>
              );
            })
          : natural !== null && (
              <div
                className={cn(
                  "absolute inset-0 overflow-hidden",
                  // `isolation` keeps the blend off the dialog.
                  mode === "diff" && "isolate",
                )}
              >
                {mode !== "diff" &&
                  checker({ width: natural.w, height: natural.h }, false)}
                <div
                  data-slot="compare-layer"
                  data-side="before"
                  className={cn(
                    layer,
                    mode === "swipe" &&
                      "[clip-path:inset(0_calc(100%-var(--cut))_0_0)]",
                    mode === "diff" && "[&_img]:bg-white",
                  )}
                >
                  {picture(before, false)}
                </div>
                <div
                  data-slot="compare-layer"
                  data-side="after"
                  className={cn(
                    layer,
                    mode === "swipe" && "[clip-path:inset(0_0_0_var(--cut))]",
                    mode === "diff" && "mix-blend-difference [&_img]:bg-white",
                  )}
                  style={mode === "onion" ? { opacity: fade / 100 } : undefined}
                >
                  {picture(after, false)}
                </div>
              </div>
            )}
        {mode === "swipe" && (
          <>
            <SwipeHandle
              className="z-4"
              grip={{
                cutting,
                onPointerDown: (e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setCutting(true);
                },
                onPointerMove: (e) => {
                  e.stopPropagation();
                  if (cutting) dragCut(e);
                },
                onPointerUp: (e) => {
                  e.stopPropagation();
                  setCutting(false);
                },
                onPointerCancel: () => setCutting(false),
              }}
            />
            <input
              type="range"
              min={0}
              max={100}
              step="any"
              value={cut}
              aria-label={`Swipe between ${before.label} (left) and ${after.label} (right)`}
              onChange={(e) => onCut(Number(e.currentTarget.value))}
              onKeyDown={keepSliderKeys}
              className="sr-only"
            />
          </>
        )}
      </div>
    </>
  );
}

/** A side at its natural size under the view's transform: its image, or its drawn content. */
function Placed({
  side,
  view,
  round,
  pixelated,
  onError,
}: {
  side: CompareItem;
  view: View | null;
  round: boolean;
  pixelated: boolean;
  onError(): void;
}) {
  const style: CSSProperties =
    view === null
      ? {}
      : {
          width: side.size.width,
          height: side.size.height,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
          borderRadius: round ? `calc(${CORNER} / ${view.z})` : 0,
          imageRendering: pixelated && view.z > 1 ? "pixelated" : undefined,
        };
  const className = cn(
    "absolute top-0 left-0 max-w-none origin-top-left",
    view === null && "invisible",
  );
  if (side.content !== undefined) {
    return (
      <div
        data-slot="compare-drawing"
        className={cn(className, "overflow-clip")}
        style={style}
      >
        {side.content}
      </div>
    );
  }
  return (
    <img
      src={side.file?.url}
      alt={`${side.label}: ${side.file?.name ?? ""}`}
      draggable={false}
      onError={onError}
      className={className}
      style={style}
    />
  );
}

/** Where the pointer is, marked in the other pane. */
function Crosshair({ x, y }: { x: number; y: number }) {
  return (
    <span
      aria-hidden
      data-testid="compare-crosshair"
      className="pointer-events-none absolute z-3 -m-2.5 size-[21px] before:absolute before:top-0 before:left-2.5 before:h-[21px] before:w-px before:bg-white before:shadow-[0_0_0_1px_rgb(0_0_0/0.65)] before:content-[''] after:absolute after:top-2.5 after:left-0 after:h-px after:w-[21px] after:bg-white after:shadow-[0_0_0_1px_rgb(0_0_0/0.65)] after:content-['']"
      style={{ left: x, top: y }}
    />
  );
}

function sideOf(item: CompareItem): CompareSide {
  return { label: item.label, content: null, size: item.size };
}

/**
 * Under the canvas: the two sides' tags with the modes between them, and
 * onion skin's opacity or difference's key on a second row.
 */
export function CompareBar({
  pair,
  mode,
  onModeChange,
  fade,
  onFade,
}: {
  pair: ComparePair;
  mode: CompareMode;
  onModeChange(mode: CompareMode): void;
  fade: number;
  onFade(fade: number): void;
}) {
  const modes = pairModes(pair);
  const before = sideOf(pair.before);
  const after = sideOf(pair.after);
  const extra =
    "col-span-full flex justify-center text-muted-foreground text-ui-sm";
  return (
    <div className="@container">
      <div
        data-slot="compare-bar"
        data-mode={mode}
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2 @max-[40rem]:grid-cols-2"
      >
        <CompareLabel
          which="before"
          side={before}
          other={after}
          className="@max-[40rem]:row-start-2"
        />
        {modes.length > 1 ? (
          <CompareModes
            mode={mode}
            onModeChange={onModeChange}
            overlayable
            modes={modes}
            className="@max-[40rem]:col-span-full @max-[40rem]:row-start-1 @max-[40rem]:justify-self-center"
          />
        ) : (
          <span />
        )}
        <CompareLabel
          which="after"
          side={after}
          other={before}
          className="justify-self-end @max-[40rem]:row-start-2"
        />
        {mode === "onion" && (
          <div className={extra}>
            <Slider
              min={0}
              max={100}
              value={[fade]}
              onValueChange={([value]) => onFade(value ?? fade)}
              onKeyDown={keepSliderKeys}
              aria-label={`Opacity of ${after.label}`}
              className="w-[min(16rem,50%)]"
            />
          </div>
        )}
        {mode === "diff" && (
          <div className={extra}>Unchanged pixels are black.</div>
        )}
      </div>
    </div>
  );
}
