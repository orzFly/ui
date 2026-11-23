import { Pane } from "@orz/ui/components/pane";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@orz/ui/components/segmented-control";
import { Slider } from "@orz/ui/components/slider";
import { cn } from "@orz/ui/lib/utils";
import { ChevronsLeftRightIcon } from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useState,
} from "react";
import {
  COMPARE_MODES,
  type CompareMode,
  useCompareMode,
} from "./compare-mode.tsx";

type Size = { width: number; height: number };

/** One of the two pictures a comparison sets against each other. */
export type CompareSide = {
  /** The side's tag, such as "v2" or "Before". */
  label: string;
  /** An `<img>`, or a block holding an SVG; the comparison sets its width. */
  content: ReactNode;
  /** Natural size in px; null while loading, or when it failed to. */
  size: Size | null;
  /** This side cannot be drawn: a deleted file, an image that 404s. */
  failed?: boolean;
};

/** The side tags a comparison falls back to where nothing names them. */
export const DEFAULT_COMPARE_LABELS = { before: "Before", after: "After" };

const NAMES: Record<CompareMode, { long: string; short: string }> = {
  "2up": { long: "Side by side", short: "2-up" },
  swipe: { long: "Swipe", short: "Swipe" },
  onion: { long: "Onion skin", short: "Onion" },
  diff: { long: "Difference", short: "Diff" },
};

/** The viewer's checkerboard, so a transparent pixel reads the same here as there. */
const CHECKER =
  "bg-[repeating-conic-gradient(#d4d4d4_0_25%,#fff_0_50%)] bg-size-[16px_16px] dark:bg-[repeating-conic-gradient(#3a3a3a_0_25%,#2a2a2a_0_50%)]";

/** The width is the comparison's; whatever is inside fills it. */
const FILL =
  "[&>:is(img,svg)]:block [&>:is(img,svg)]:h-auto [&>:is(img,svg)]:w-full [&>:is(img,svg)]:max-w-none";

const TICK: Record<"before" | "after", string> = {
  before: "bg-(--diff-deletion)",
  after: "bg-(--diff-addition)",
};

/** The side's colour along the top of its picture. */
export const STRIP: Record<"before" | "after", string> = {
  before: "before:bg-(--diff-deletion)",
  after: "before:bg-(--diff-addition)",
};

export type MediaCompareProps = {
  before: CompareSide;
  after: CompareSide;
  /** Where two sizes line up in the overlay modes: a screenshot's corner, a diagram's top centre. Default `"start"`. */
  align?: "start" | "center";
  /** What shows through transparency: the viewer's checkerboard, or the page. Default `"checker"`. */
  backdrop?: "checker" | "page";
  /** Named at the head's start, beside the modes. */
  title?: ReactNode;
  /** More controls at the head's end. */
  actions?: ReactNode;
  /** Drawn in place of the comparison, with no mode pressed: a source view, an error. */
  replacement?: ReactNode;
  /** The modes offered, all four by default. With one there is no mode control. */
  modes?: readonly CompareMode[];
  /** The mode, controlled. Default: the nearest `CompareModeProvider`'s, else the comparison's own. */
  mode?: CompareMode;
  /** Where an uncontrolled comparison outside a provider starts. Default `"2up"`. */
  defaultMode?: CompareMode;
  onModeChange?(mode: CompareMode): void;
  /**
   * Given, each side's picture is a button opening both in a viewer, and
   * its content has to be phrasing content to sit in one.
   */
  onOpen?(): void;
  className?: string;
};

/**
 * Two versions of a picture, compared side by side, by swipe, by onion skin
 * or by difference. It knows nothing of what the two are: an image and a
 * rendered diagram both come in as `content` with a natural size.
 *
 * Every mode draws both sides at one scale (the wider fills the space, and
 * neither is enlarged past its own size), so a picture that grew still looks
 * bigger, and in the overlay modes a pixel sits on the pixel it replaced.
 * The overlay modes wait until both sides have a size, and a side that
 * failed leaves side by side the only one.
 */
export function MediaCompare({
  before,
  after,
  align = "start",
  backdrop = "checker",
  title,
  actions,
  replacement,
  modes = COMPARE_MODES,
  mode: controlled,
  defaultMode,
  onModeChange,
  onOpen,
  className,
}: MediaCompareProps) {
  const [chosen, setMode] = useCompareMode({
    mode: controlled,
    defaultMode,
    onModeChange,
  });
  const overlayable =
    before.size !== null &&
    after.size !== null &&
    !before.failed &&
    !after.failed;
  // Falling back leaves the chosen mode alone: a comparison that cannot
  // overlay must not switch every other one sharing its mode back with it.
  const mode = overlayable && modes.includes(chosen) ? chosen : "2up";
  const choosable = modes.length > 1;
  const head = choosable || title !== undefined || actions !== undefined;

  return (
    <Pane
      purpose="document"
      frame="card"
      data-slot="media-compare"
      data-backdrop={backdrop}
      className={cn("@container overflow-clip select-none", className)}
    >
      {head && (
        <Pane
          purpose="toolbar"
          className="flex min-w-0 items-center gap-2 border-b px-2 py-1.5"
        >
          {choosable && (
            <CompareModes
              mode={replacement === undefined ? mode : null}
              onModeChange={setMode}
              overlayable={overlayable}
              modes={modes}
            />
          )}
          {title !== undefined && (
            <span className="min-w-0 truncate text-muted-foreground text-ui-sm">
              {title}
            </span>
          )}
          {actions !== undefined && (
            <span className="ms-auto flex shrink-0 items-center gap-1">
              {actions}
            </span>
          )}
        </Pane>
      )}
      {replacement ??
        (mode === "2up" || before.size === null || after.size === null ? (
          <SideBySide
            before={before}
            after={after}
            align={align}
            backdrop={backdrop}
            onOpen={onOpen}
          />
        ) : (
          <Overlay
            mode={mode}
            before={{ ...before, size: before.size }}
            after={{ ...after, size: after.size }}
            align={align}
            backdrop={backdrop}
          />
        ))}
    </Pane>
  );
}

/**
 * The modes as one segmented control. The overlay three are off until both
 * sides have a size to line up; `mode` null presses none.
 */
export function CompareModes({
  mode,
  onModeChange,
  overlayable,
  modes = COMPARE_MODES,
  className,
}: {
  mode: CompareMode | null;
  onModeChange(mode: CompareMode): void;
  overlayable: boolean;
  modes?: readonly CompareMode[];
  className?: string;
}) {
  return (
    <SegmentedControl
      aria-label="Comparison"
      value={mode ?? ""}
      onValueChange={(value) => onModeChange(value as CompareMode)}
      className={cn("shrink-0", className)}
    >
      {COMPARE_MODES.filter((value) => modes.includes(value)).map((value) => (
        <SegmentedControlItem
          key={value}
          value={value}
          aria-label={NAMES[value].long}
          title={NAMES[value].long}
          disabled={value !== "2up" && !overlayable}
          className="whitespace-nowrap"
        >
          <span className="@max-[26rem]:hidden">{NAMES[value].long}</span>
          <span aria-hidden className="hidden @max-[26rem]:inline">
            {NAMES[value].short}
          </span>
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

function SideBySide({
  before,
  after,
  align,
  backdrop,
  onOpen,
}: {
  before: CompareSide;
  after: CompareSide;
  align: "start" | "center";
  backdrop: "checker" | "page";
  onOpen?: () => void;
}) {
  // A side that failed never reports a size, so the other is the widest there
  // is; waiting on it would squeeze a wide picture into half the stage.
  const widest =
    before.size !== null && after.size !== null
      ? Math.max(before.size.width, after.size.width)
      : before.size !== null && after.failed
        ? before.size.width
        : after.size !== null && before.failed
          ? after.size.width
          : null;
  const pane = (side: CompareSide, which: "before" | "after") => {
    const sized = side.size !== null;
    // Unsized until both are known: a box guessed at now would jump when
    // the other side's size arrives.
    const style: CSSProperties | undefined =
      widest === null || side.size === null
        ? undefined
        : {
            width: `${(side.size.width / widest) * 100}%`,
            maxWidth: `${side.size.width}px`,
            ...(align === "center" ? { marginInline: "auto" } : {}),
          };
    // A sized box is framed and filled with the backdrop, a strip of the
    // side's colour along its top.
    const box = cn(
      "relative block max-w-full",
      FILL,
      sized &&
        "overflow-clip rounded-item outline-1 outline-border -outline-offset-1 before:absolute before:inset-x-0 before:top-0 before:z-1 before:h-0.5 before:content-[''] raymond:rounded-none raymond:outline-(--3d-shadow)",
      sized && STRIP[which],
      sized && (backdrop === "checker" ? CHECKER : "bg-background"),
    );
    return (
      <div data-side={which} className="grid min-w-0 gap-1.5">
        <CompareLabel
          which={which}
          side={side}
          other={which === "before" ? after : before}
        />
        {onOpen !== undefined && !side.failed ? (
          <button
            type="button"
            aria-label="Open in the viewer"
            data-slot="compare-box"
            data-sized={sized ? "" : undefined}
            onClick={onOpen}
            className={cn(
              box,
              "w-full cursor-zoom-in text-start outline-none focus-visible:focus-ring",
            )}
            style={style}
          >
            {side.content}
          </button>
        ) : (
          <div
            data-slot="compare-box"
            data-sized={sized ? "" : undefined}
            className={box}
            style={style}
          >
            {side.content}
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="p-3">
      <div
        data-slot="compare-sides"
        className="grid grid-cols-2 items-start gap-3 @max-[30rem]:grid-cols-1"
      >
        {pane(before, "before")}
        {pane(after, "after")}
      </div>
    </div>
  );
}

type SizedSide = CompareSide & { size: Size };

function Overlay({
  mode,
  before,
  after,
  align,
  backdrop,
}: {
  mode: Exclude<CompareMode, "2up">;
  before: SizedSide;
  after: SizedSide;
  align: "start" | "center";
  backdrop: "checker" | "page";
}) {
  const [cut, setCut] = useState(50);
  const [fade, setFade] = useState(50);
  const width = Math.max(before.size.width, after.size.width);
  const height = Math.max(before.size.height, after.size.height);
  const place = (side: SizedSide): CSSProperties => ({
    width: `${(side.size.width / width) * 100}%`,
    left:
      align === "center"
        ? `${((width - side.size.width) / 2 / width) * 100}%`
        : 0,
  });
  const stageWidth = `min(100%, ${width}px)`;
  const diff = mode === "diff";
  // Same-coloured opaque grounds under both sides in difference, so a pixel
  // transparent in both counts as unchanged.
  const box = cn(
    "absolute top-0",
    FILL,
    diff && (backdrop === "checker" ? "bg-white" : "bg-background"),
  );
  // Both layers are cut, on the full-stage layer rather than on the picture:
  // cutting only the new one lets the old show through its transparent
  // pixels, and two pictures of different sizes cut by their own boxes would
  // be cut in two different places.
  const layer = "pointer-events-none absolute inset-0";

  return (
    <div className="p-3">
      <div
        data-slot="compare-stage"
        data-mode={mode}
        className={cn(
          "group/stage relative mx-auto touch-pan-y overflow-clip rounded-item outline-1 outline-border -outline-offset-1 raymond:rounded-none raymond:outline-(--3d-shadow)",
          // `isolation` keeps the blend off the page.
          diff
            ? "isolate bg-black"
            : backdrop === "checker"
              ? CHECKER
              : "bg-background",
        )}
        style={
          {
            width: stageWidth,
            aspectRatio: `${width} / ${height}`,
            "--cut": `${cut}%`,
          } as CSSProperties
        }
      >
        <div
          data-slot="compare-layer"
          data-side="before"
          className={cn(
            layer,
            mode === "swipe" &&
              "[clip-path:inset(0_calc(100%-var(--cut))_0_0)]",
          )}
        >
          <div className={box} style={place(before)}>
            {before.content}
          </div>
        </div>
        <div
          data-slot="compare-layer"
          data-side="after"
          className={cn(
            layer,
            mode === "swipe" && "[clip-path:inset(0_0_0_var(--cut))]",
            diff && "mix-blend-difference",
          )}
          style={mode === "onion" ? { opacity: fade / 100 } : undefined}
        >
          <div className={box} style={place(after)}>
            {after.content}
          </div>
        </div>
        {mode === "swipe" && (
          <>
            <SwipeHandle />
            {/* The whole stage is the slider. Its thumb is a hair wide so
                that where the pointer lands is where the cut goes: a native
                thumb's half-width would put the two up to 8px apart near
                either edge. */}
            <input
              type="range"
              min={0}
              max={100}
              step="any"
              value={cut}
              aria-label={`Swipe between ${before.label} (left) and ${after.label} (right)`}
              onChange={(e) => setCut(Number(e.currentTarget.value))}
              className="absolute inset-0 z-3 m-0 size-full cursor-ew-resize appearance-none bg-transparent opacity-0 [&::-moz-range-thumb]:w-px [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:h-full [&::-webkit-slider-thumb]:w-px [&::-webkit-slider-thumb]:appearance-none"
            />
          </>
        )}
      </div>
      {/* On touch as tall as the slider's hit area, which the frame
          clips below, in every mode, so a change of mode moves nothing. */}
      <div
        data-mode={mode}
        className={cn(
          "mx-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2.5 text-muted-foreground text-ui-sm touch:min-h-11",
          mode === "onion" ? "justify-center" : "justify-between",
        )}
        style={{ maxWidth: stageWidth }}
      >
        <CompareLabel which="before" side={before} other={after} />
        {mode === "onion" && (
          <Slider
            min={0}
            max={100}
            value={[fade]}
            onValueChange={([value]) => setFade(value ?? fade)}
            aria-label={`Opacity of ${after.label}`}
            className="w-[min(16rem,50%)]"
          />
        )}
        {diff && (
          <span className="@max-[26rem]:order-3 @max-[26rem]:basis-full @max-[26rem]:text-center">
            Unchanged pixels are black.
          </span>
        )}
        <CompareLabel which="after" side={after} other={before} />
      </div>
    </div>
  );
}

/**
 * Swipe's split: a line down the stage at `--cut` with a grip on it, ringed
 * while the slider that moves it has the keyboard's focus. `grip` takes the
 * grip's pointer events, for a canvas where only the grip moves the split.
 */
export function SwipeHandle({
  grip,
  className,
}: {
  grip?: {
    cutting: boolean;
    onPointerDown(e: PointerEvent<HTMLElement>): void;
    onPointerMove(e: PointerEvent<HTMLElement>): void;
    onPointerUp(e: PointerEvent<HTMLElement>): void;
    onPointerCancel(): void;
  };
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 left-(--cut) z-2 -ml-px w-0.5 bg-foreground shadow-[0_0_0_1px_color-mix(in_oklab,var(--background)_70%,transparent)]",
        className,
      )}
    >
      <span
        data-cutting={grip?.cutting ? "" : undefined}
        onPointerDown={grip?.onPointerDown}
        onPointerMove={grip?.onPointerMove}
        onPointerUp={grip?.onPointerUp}
        onPointerCancel={grip?.onPointerCancel}
        className={cn(
          "absolute top-1/2 left-1/2 grid -translate-1/2 place-items-center rounded-full bg-foreground text-background shadow-menu group-has-[input:focus-visible]/stage:focus-ring [&_svg]:size-4",
          "raymond:rounded-none raymond:bg-(--3d-face) raymond:text-foreground raymond:shadow-raised",
          grip === undefined
            ? "size-7"
            : // A 52px target round a 32px grip.
              "pointer-events-auto size-8 cursor-ew-resize touch-none after:absolute after:-inset-2.5 after:rounded-full after:content-['']",
        )}
      >
        <ChevronsLeftRightIcon />
      </span>
    </div>
  );
}

/**
 * A side's colour, its tag and its natural size. The size earns the room
 * because scaling hides it: two screenshots drawn at one width look the same
 * size whatever their pixels say. A dimension the two disagree on is marked.
 */
export function CompareLabel({
  which,
  side,
  other,
  className,
}: {
  which: "before" | "after";
  side: CompareSide;
  other: CompareSide;
  className?: string;
}) {
  const dimension = (key: keyof Size) => {
    const value = side.size?.[key];
    const differs =
      other.size !== null && value !== undefined && value !== other.size[key];
    return differs ? (
      <mark
        data-changed=""
        className={cn(
          "rounded-[min(var(--radius-chip),3px)] px-0.5 text-inherit",
          which === "before"
            ? "bg-[color-mix(in_oklab,var(--diff-deletion)_18%,transparent)]"
            : "bg-[color-mix(in_oklab,var(--diff-addition)_22%,transparent)]",
        )}
      >
        {value}
      </mark>
    ) : (
      value
    );
  };
  return (
    <span
      data-slot="compare-label"
      data-side={which}
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-foreground text-ui-sm leading-none",
        className,
      )}
    >
      <CompareTick which={which} />
      {/* A version is always short; an author's own tag need not be. */}
      <span
        data-slot="compare-label-name"
        className="min-w-0 max-w-[18ch] truncate font-semibold"
        title={side.label}
      >
        {side.label}
      </span>
      {side.size !== null && (
        <span className="flex-none font-mono text-muted-foreground text-ui-xs leading-none tabular-nums">
          {dimension("width")}×{dimension("height")}
        </span>
      )}
    </span>
  );
}

/** A side's colour: the older red, the newer green, as a diff's are. */
export function CompareTick({ which }: { which: "before" | "after" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 flex-none rounded-[min(var(--radius-chip),2px)] raymond:rounded-none",
        TICK[which],
      )}
    />
  );
}
