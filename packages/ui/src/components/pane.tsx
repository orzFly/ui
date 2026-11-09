import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * What a region of an app's frame is for, which decides how each style draws
 * it. `app` is the frame itself, the box its other panes sit side by side in;
 * `document` holds what is read or written (a message, a diff, an
 * editor); `toolbar` holds the controls that act on it; `statusbar` says
 * how it stands, in a line along the window's foot (a line count, the
 * first error); `panel` holds everything else on the window's face (a
 * sidebar, a details column, a composer's rows of fields).
 * `window` is a window of the app's own that floats over the rest (a
 * composer docked in a corner), and `titlebar` its caption: its title and
 * the buttons that minimise, resize or close it.
 */
type PanePurpose =
  | "app"
  | "document"
  | "toolbar"
  | "statusbar"
  | "panel"
  | "window"
  | "titlebar";

// The default style draws none of them: the caller's own borders and fills
// stay. A style redraws a pane where it stands: what it holds and in what
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
// the window text as Explorer's is; a panel is the face. A window is the face inside a raised frame, square; its titlebar
// spans it in the caption gradient with its title in bold, grey while the
// focus is elsewhere on the page, and its icon buttons are the small raised
// caption boxes.
// Each drops the caller's dividing rule, which the edges replace.
//
// A well's bevel is an inset shadow, which a scrolling element paints its
// content over: the well is the frame around a scroller, never the scroller,
// and its two pixels of padding keep the scroller inside the bevel.
const PURPOSE: Record<PanePurpose, string> = {
  app: "raymond:gap-0.5 raymond:bg-(--3d-face) raymond:p-0.5",
  document:
    "raymond:border-transparent raymond:bg-(--window) raymond:bg-clip-padding raymond:p-0.5 raymond:shadow-sunken raymond:[--background:var(--window)]",
  toolbar:
    "raymond:relative raymond:h-auto raymond:min-h-0 raymond:border-transparent raymond:bg-(--3d-face) raymond:py-[3px] raymond:shadow-[inset_0_1px_var(--3d-highlight),inset_0_-1px_var(--3d-shadow)] raymond:before:absolute raymond:before:inset-y-1 raymond:before:left-0.5 raymond:before:w-[3px] raymond:before:shadow-[inset_1px_1px_var(--3d-highlight),inset_-1px_-1px_var(--3d-shadow)] raymond:before:content-['']",
  statusbar:
    "raymond:relative raymond:min-h-0 raymond:border-transparent raymond:bg-(--3d-face) raymond:text-foreground raymond:[--muted-foreground:var(--foreground)] raymond:px-[5px] raymond:py-1 raymond:before:pointer-events-none raymond:before:absolute raymond:before:inset-0.5 raymond:before:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)] raymond:before:content-['']",
  panel: "raymond:border-transparent raymond:bg-(--3d-face)",
  window:
    "raymond:rounded-none raymond:border-0 raymond:bg-(--3d-face) raymond:p-[3px] raymond:shadow-raised",
  titlebar:
    "raymond:h-auto raymond:min-h-0 raymond:gap-0.5 raymond:border-0 raymond:bg-[linear-gradient(to_right,var(--caption),var(--caption-gradient))] raymond:py-0.5 raymond:pr-0.5 raymond:pl-1 raymond:font-bold raymond:text-(--caption-foreground) raymond:[--font-weight-medium:700] raymond:in-[body:has(:focus:not([data-purpose=window]_*))]:bg-[linear-gradient(to_right,var(--caption-inactive),var(--caption-inactive-gradient))] raymond:in-[body:has(:focus:not([data-purpose=window]_*))]:text-(--caption-inactive-foreground) raymond:[&_button[data-size^=icon]]:h-3.5 raymond:[&_button[data-size^=icon]]:w-4 raymond:[&_button[data-size^=icon]]:min-w-0 raymond:[&_button[data-size^=icon]]:bg-(--3d-face) raymond:[&_button[data-size^=icon]]:text-foreground raymond:[&_button[data-size^=icon]]:shadow-raised raymond:[&_button[data-size^=icon]:active]:shadow-pressed raymond:[&_button[data-size^=icon]:hover]:bg-(--3d-face) raymond:[&_button[data-size^=icon]:hover]:shadow-raised raymond:[&_button[data-size^=icon]_svg]:size-2.5 raymond:[&_button[data-size^=icon]_svg]:stroke-3",
};

/** A region of an app's frame, drawn for its purpose. With `asChild` it is the caller's element. */
function Pane({
  purpose,
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  purpose: PanePurpose;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="pane"
      data-purpose={purpose}
      className={cn(PURPOSE[purpose], className)}
      {...props}
    />
  );
}

export { Pane, type PanePurpose };
