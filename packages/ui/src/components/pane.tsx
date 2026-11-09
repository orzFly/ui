import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * What a region of an app's frame is for, which decides how each style draws
 * it. `app` is the frame itself, the box its other panes sit side by side in;
 * `document` holds what is read or written (a message, a diff, an
 * editor); `toolbar` holds the controls that act on it; `statusbar` says
 * how it stands, in a line along the window's foot (a line count, the
 * first error); `sidebar` is the column of places to go beside the rest (an
 * app's folders, a settings screen's sections, a file list); `panel` holds
 * everything else on the window's face (a details column, a composer's rows
 * of fields). `window` is a window of the app's own that floats over the
 * rest (a composer docked in a corner), and `titlebar` its caption: its
 * title and the buttons that minimise, resize or close it. `banner` is the
 * bar across the top of a site or app that its pages scroll under (a logo,
 * the sections, search); it keeps the height its caller gives it, which
 * whatever sticks below it is offset by.
 */
type PanePurpose =
  | "app"
  | "banner"
  | "document"
  | "toolbar"
  | "statusbar"
  | "sidebar"
  | "panel"
  | "window"
  | "titlebar";

type PaneBreakpoint = "initial" | "sm" | "md" | "lg" | "xl";

/**
 * One value, or the value from each breakpoint up, as
 * `{ initial: "bottom", md: "end" }`: a pane's place moves as the layout
 * puts its panes side by side.
 */
type PaneResponsive<T> = T | Partial<Record<PaneBreakpoint, T>>;

/** The side of a pane that meets the pane beside it, `"none"` where none does. */
type PaneEdge = "top" | "bottom" | "start" | "end" | "none";

/**
 * The edge of the window a `window` is docked against, which draws no edge
 * or rounding there; `"fill"` when it fills the window, `"none"` when it
 * floats.
 */
type PaneDocked = "top" | "bottom" | "start" | "end" | "fill" | "none";

/**
 * A pane set in the flow of another rather than filling a region: `card`
 * for what someone wrote or fills in (a comment, a reply box), `inset` for a
 * sample shown on its own (a preview of an editor's text).
 */
type PaneFrame = "card" | "inset";

const BREAKPOINTS: readonly PaneBreakpoint[] = [
  "initial",
  "sm",
  "md",
  "lg",
  "xl",
];

// The default style rules off each edge a pane meets another at, and fills a
// sidebar only while it stands beside the rest: a sidebar that fills a phone's
// screen, or sits above the rest, is no column. A titlebar heads its window
// and a status bar runs along its foot, so their rules are their own. Every
// class is written out whole, for Tailwind to find.
const LOOK: Record<PanePurpose, string> = {
  app: "bg-background text-foreground",
  banner:
    "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
  document: "",
  toolbar: "",
  statusbar: "border-t text-muted-foreground text-ui-sm",
  sidebar: "",
  panel: "",
  window: "bg-background shadow-overlay",
  titlebar: "border-b bg-muted/50",
};

const EDGE: Record<
  PaneBreakpoint,
  Record<Exclude<PaneEdge, "none">, readonly [on: string, off: string]>
> = {
  initial: {
    top: ["border-t", "border-t-0"],
    bottom: ["border-b", "border-b-0"],
    start: ["border-s", "border-s-0"],
    end: ["border-e", "border-e-0"],
  },
  sm: {
    top: ["sm:border-t", "sm:border-t-0"],
    bottom: ["sm:border-b", "sm:border-b-0"],
    start: ["sm:border-s", "sm:border-s-0"],
    end: ["sm:border-e", "sm:border-e-0"],
  },
  md: {
    top: ["md:border-t", "md:border-t-0"],
    bottom: ["md:border-b", "md:border-b-0"],
    start: ["md:border-s", "md:border-s-0"],
    end: ["md:border-e", "md:border-e-0"],
  },
  lg: {
    top: ["lg:border-t", "lg:border-t-0"],
    bottom: ["lg:border-b", "lg:border-b-0"],
    start: ["lg:border-s", "lg:border-s-0"],
    end: ["lg:border-e", "lg:border-e-0"],
  },
  xl: {
    top: ["xl:border-t", "xl:border-t-0"],
    bottom: ["xl:border-b", "xl:border-b-0"],
    start: ["xl:border-s", "xl:border-s-0"],
    end: ["xl:border-e", "xl:border-e-0"],
  },
};

const SIDEBAR_FILL: Record<PaneBreakpoint, readonly [on: string, off: string]> =
  {
    initial: ["bg-sidebar text-sidebar-foreground", ""],
    sm: [
      "sm:bg-sidebar sm:text-sidebar-foreground",
      "sm:bg-transparent sm:text-inherit",
    ],
    md: [
      "md:bg-sidebar md:text-sidebar-foreground",
      "md:bg-transparent md:text-inherit",
    ],
    lg: [
      "lg:bg-sidebar lg:text-sidebar-foreground",
      "lg:bg-transparent lg:text-inherit",
    ],
    xl: [
      "xl:bg-sidebar xl:text-sidebar-foreground",
      "xl:bg-transparent xl:text-inherit",
    ],
  };

const DOCKED: Record<PaneBreakpoint, Record<PaneDocked, string>> = {
  initial: {
    none: "rounded-overlay border",
    fill: "rounded-none border-0",
    top: "rounded-overlay rounded-t-none border border-t-0",
    bottom: "rounded-overlay rounded-b-none border border-b-0",
    start: "rounded-overlay rounded-s-none border border-s-0",
    end: "rounded-overlay rounded-e-none border border-e-0",
  },
  sm: {
    none: "sm:rounded-overlay sm:border",
    fill: "sm:rounded-none sm:border-0",
    top: "sm:rounded-overlay sm:rounded-t-none sm:border sm:border-t-0",
    bottom: "sm:rounded-overlay sm:rounded-b-none sm:border sm:border-b-0",
    start: "sm:rounded-overlay sm:rounded-s-none sm:border sm:border-s-0",
    end: "sm:rounded-overlay sm:rounded-e-none sm:border sm:border-e-0",
  },
  md: {
    none: "md:rounded-overlay md:border",
    fill: "md:rounded-none md:border-0",
    top: "md:rounded-overlay md:rounded-t-none md:border md:border-t-0",
    bottom: "md:rounded-overlay md:rounded-b-none md:border md:border-b-0",
    start: "md:rounded-overlay md:rounded-s-none md:border md:border-s-0",
    end: "md:rounded-overlay md:rounded-e-none md:border md:border-e-0",
  },
  lg: {
    none: "lg:rounded-overlay lg:border",
    fill: "lg:rounded-none lg:border-0",
    top: "lg:rounded-overlay lg:rounded-t-none lg:border lg:border-t-0",
    bottom: "lg:rounded-overlay lg:rounded-b-none lg:border lg:border-b-0",
    start: "lg:rounded-overlay lg:rounded-s-none lg:border lg:border-s-0",
    end: "lg:rounded-overlay lg:rounded-e-none lg:border lg:border-e-0",
  },
  xl: {
    none: "xl:rounded-overlay xl:border",
    fill: "xl:rounded-none xl:border-0",
    top: "xl:rounded-overlay xl:rounded-t-none xl:border xl:border-t-0",
    bottom: "xl:rounded-overlay xl:rounded-b-none xl:border xl:border-b-0",
    start: "xl:rounded-overlay xl:rounded-s-none xl:border xl:border-s-0",
    end: "xl:rounded-overlay xl:rounded-e-none xl:border xl:border-e-0",
  },
};

// Under raymond a card framed on the face is etched, as a group box's edge
// is, and an inset sample a sunken well in the window colour, as the
// Display Properties' preview is; a document's well takes the card's place
// on a document.
const FRAME: Record<PaneFrame, string> = {
  card: "rounded-surface border bg-card text-card-foreground raymond:border-(--3d-shadow) raymond:shadow-[inset_1px_1px_var(--3d-highlight),1px_1px_var(--3d-highlight)]",
  inset:
    "rounded-frame border bg-muted/40 raymond:border-transparent raymond:bg-(--window) raymond:bg-clip-padding raymond:shadow-sunken",
};

/** Each breakpoint a value is given at, smallest first. */
function steps<T extends string>(
  value: PaneResponsive<T>,
): [PaneBreakpoint, T][] {
  if (typeof value === "string") return [["initial", value]];
  return BREAKPOINTS.flatMap((at) => {
    const each = value[at];
    return each === undefined ? [] : [[at, each] as [PaneBreakpoint, T]];
  });
}

const beside = (edge: PaneEdge) => edge === "start" || edge === "end";

function edgeClasses(edge: PaneResponsive<PaneEdge>, sidebar: boolean) {
  const classes: string[] = [];
  let was: PaneEdge = "none";
  for (const [at, side] of steps(edge)) {
    if (side === was) continue;
    if (was !== "none") classes.push(EDGE[at][was][1]);
    if (side !== "none") classes.push(EDGE[at][side][0]);
    if (sidebar && beside(side) !== beside(was)) {
      classes.push(SIDEBAR_FILL[at][beside(side) ? 0 : 1]);
    }
    was = side;
  }
  return classes;
}

function dockedClasses(docked: PaneResponsive<PaneDocked>) {
  return steps(docked).map(([at, side]) => DOCKED[at][side]);
}

// A style redraws a pane where it stands: what it holds and in what
// order stay the caller's, though its spacing may tighten. Under raymond an
// app is the face, its panes parted by a splitter's width of it; a
// document is a sunken well in the window colour, as Outlook Express draws
// its preview pane, and a part inside that fills with bg-background fills
// with the window colour too; a toolbar is a rebar band on the face, as tall
// as its controls and three pixels more each way, whatever height the caller
// gave it for the default style, an etched line above and below it and a
// gripper drawn over its leading padding; a status bar is the face with
// one shallow sunken panel inset two pixels from its edges, as Explorer
// draws its own, and as tall as its text and that panel, its quiet text in
// the window text as Explorer's is; a sidebar and a panel are the face. A
// window is the face inside a raised frame, square, docked or not; its
// titlebar spans it in the caption gradient with its title in bold, grey
// while the focus is elsewhere on the page, and its icon buttons are the
// small raised caption boxes. A banner is a rebar band too, opaque, but
// keeps its caller's height. Each keeps the default style's rules at their
// width, in no colour, as the edges replace them.
//
// A well's bevel is an inset shadow, which a scrolling element paints its
// content over: the well is the frame around a scroller, never the scroller,
// and its two pixels of padding keep the scroller inside the bevel.
const PURPOSE: Record<PanePurpose, string> = {
  app: "raymond:gap-0.5 raymond:bg-(--3d-face) raymond:p-0.5",
  banner:
    "raymond:border-transparent raymond:bg-(--3d-face) raymond:backdrop-blur-none raymond:shadow-[inset_0_1px_var(--3d-highlight),inset_0_-1px_var(--3d-shadow)]",
  document:
    "raymond:border-transparent raymond:bg-(--window) raymond:bg-clip-padding raymond:p-0.5 raymond:shadow-sunken raymond:[--background:var(--window)]",
  toolbar:
    "raymond:relative raymond:h-auto raymond:min-h-0 raymond:border-transparent raymond:bg-(--3d-face) raymond:py-[3px] raymond:shadow-[inset_0_1px_var(--3d-highlight),inset_0_-1px_var(--3d-shadow)] raymond:before:absolute raymond:before:inset-y-1 raymond:before:left-0.5 raymond:before:w-[3px] raymond:before:shadow-[inset_1px_1px_var(--3d-highlight),inset_-1px_-1px_var(--3d-shadow)] raymond:before:content-['']",
  statusbar:
    "raymond:relative raymond:min-h-0 raymond:border-transparent raymond:bg-(--3d-face) raymond:text-foreground raymond:[--muted-foreground:var(--foreground)] raymond:px-[5px] raymond:py-1 raymond:before:pointer-events-none raymond:before:absolute raymond:before:inset-0.5 raymond:before:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)] raymond:before:content-['']",
  sidebar: "raymond:border-transparent raymond:bg-(--3d-face)",
  panel: "raymond:border-transparent raymond:bg-(--3d-face)",
  window:
    "raymond:rounded-none raymond:border-0 raymond:bg-(--3d-face) raymond:p-[3px] raymond:shadow-raised",
  titlebar:
    "raymond:h-auto raymond:min-h-0 raymond:gap-0.5 raymond:border-0 raymond:bg-[linear-gradient(to_right,var(--caption),var(--caption-gradient))] raymond:py-0.5 raymond:pr-0.5 raymond:pl-1 raymond:font-bold raymond:text-(--caption-foreground) raymond:[--font-weight-medium:700] raymond:in-[body:has(:focus:not([data-purpose=window]_*))]:bg-[linear-gradient(to_right,var(--caption-inactive),var(--caption-inactive-gradient))] raymond:in-[body:has(:focus:not([data-purpose=window]_*))]:text-(--caption-inactive-foreground) raymond:[&_button[data-size^=icon]]:h-3.5 raymond:[&_button[data-size^=icon]]:w-4 raymond:[&_button[data-size^=icon]]:min-w-0 raymond:[&_button[data-size^=icon]]:bg-(--3d-face) raymond:[&_button[data-size^=icon]]:text-foreground raymond:[&_button[data-size^=icon]]:shadow-raised raymond:[&_button[data-size^=icon]:active]:shadow-pressed raymond:[&_button[data-size^=icon]:hover]:bg-(--3d-face) raymond:[&_button[data-size^=icon]:hover]:shadow-raised raymond:[&_button[data-size^=icon]:focus-visible]:shadow-[inset_-1px_-1px_var(--3d-dark-shadow),inset_1px_1px_var(--3d-highlight),inset_-2px_-2px_var(--3d-shadow),inset_2px_2px_var(--3d-light)] raymond:[&_button[data-size^=icon]]:[--focus-offset:-3px] raymond:[&_button[data-size^=icon]_svg]:size-2.5 raymond:[&_button[data-size^=icon]_svg]:stroke-3",
};

/** A region of an app's frame, drawn for its purpose. With `asChild` it is the caller's element. */
function Pane({
  purpose,
  edge = "none",
  docked = "none",
  frame,
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  purpose: PanePurpose;
  /** The side that meets the pane beside it, where the default style rules it off. */
  edge?: PaneResponsive<PaneEdge>;
  /** A `window`'s: the edge of the window it is docked against. */
  docked?: PaneResponsive<PaneDocked>;
  /** Set in the flow of another pane, framed on its own. */
  frame?: PaneFrame;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="pane"
      data-purpose={purpose}
      className={cn(
        LOOK[purpose],
        purpose === "window" && dockedClasses(docked),
        frame && FRAME[frame],
        edgeClasses(edge, purpose === "sidebar"),
        PURPOSE[purpose],
        className,
      )}
      {...props}
    />
  );
}

export {
  Pane,
  type PaneBreakpoint,
  type PaneDocked,
  type PaneEdge,
  type PaneFrame,
  type PanePurpose,
  type PaneResponsive,
};
