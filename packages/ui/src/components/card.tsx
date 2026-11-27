import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        // Clipped, not hidden: a hidden overflow makes the card a scroll
        // container, whose least height in a flex column or an auto grid
        // track is 0, so each card of a stack in a scroller was squashed to
        // its padding. Its least width stays 0, as it was, so the card still
        // narrows to its column and clips a wider child.
        "group/card flex min-w-0 flex-col gap-(--card-spacing) overflow-clip rounded-surface bg-card py-(--card-spacing) text-ui text-card-foreground border [--card-spacing:--spacing(3)] has-[>[data-slot=card-header]]:pt-0 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(2)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-surface *:[img:last-child]:rounded-b-surface",
        // Under raymond a card is a group box: the border gives way to an
        // etched frame, a dark line with a lit one a pixel down and right,
        // drawn behind the content. With a header the frame's top runs
        // through the header's middle, where the header is its legend, and
        // on touch a header that holds a target (an action, a link) is the
        // touch spacing tall, its middle half that down.
        "raymond:relative raymond:isolate raymond:border-0 raymond:before:pointer-events-none raymond:before:absolute raymond:before:inset-[0_1px_1px_0] raymond:before:-z-1 raymond:before:border raymond:before:border-(--3d-shadow) raymond:before:shadow-[inset_1px_1px_var(--3d-highlight),1px_1px_var(--3d-highlight)] raymond:before:content-[''] raymond:has-[>[data-slot=card-header]]:before:top-[calc(var(--spacing-row)/2)] raymond:touch:has-[>[data-slot=card-header]_:is(a[href],button)]:before:top-[calc(var(--spacing-touch)/2)]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A region of modules: its children stand a module gap apart, and the same
 * gap pads the region's edge. One column unless `className` sets the columns
 * and spans. A `ModuleGrid` inside another adds no padding of its own, so a
 * nested stack's edges line up with its neighbours'.
 */
function ModuleGrid({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & {
  /** Renders the child element (a `main`, a `section`) as the grid. */
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="module-grid"
      className={cn(
        "grid min-w-0 content-start gap-module p-module *:min-w-0 in-data-[slot=module-grid]:p-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The square that heads a module, in a card's header, a viewer's toolbar or
 * an overlay's title: the module's icon in `primary` on the marker tint, or a
 * ▶ when it has none. The square keeps the ▶ apart from a row's disclosure
 * chevron, so a marker never reads as "expand".
 */
function ModuleMarker({
  icon,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  /** An icon, sized and stroked by the marker; omitted, the marker draws a solid square. */
  icon?: React.ReactNode;
}) {
  return (
    <span
      data-slot="module-marker"
      aria-hidden="true"
      className={cn(
        "inline-grid size-4 shrink-0 place-items-center bg-marker text-primary [&_svg:not([data-default])]:size-[11px] [&_svg:not([data-default])]:stroke-[2.4]",
        className,
      )}
      {...props}
    >
      {icon ?? (
        <svg
          data-default=""
          aria-hidden="true"
          width="6"
          height="6"
          viewBox="0 0 6 6"
          fill="currentColor"
        >
          <rect width="6" height="6" />
        </svg>
      )}
    </span>
  );
}

/**
 * The card's header: a ruled strip holding the module marker, then the title
 * and the action.
 */
function CardHeader({
  className,
  icon,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  /** The module marker's icon; omitted, the marker draws a solid square. */
  icon?: React.ReactNode;
}) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        // On touch a header that holds a target, an action or a link, is the
        // touch spacing tall, so the card, which clips, leaves its hit area
        // whole and the content under it stands clear; an icon button's own
        // margin leaves the room at the end.
        "group/card-header @container/card-header flex min-h-row flex-wrap items-center gap-x-2 gap-y-0.5 border-b bg-muted px-2 py-0.5 text-ui-sm touch:has-[a[href],button]:min-h-touch",
        // Under raymond the header is the group box's legend, on the card's
        // face with no rule: the frame breaks around each of its parts,
        // which mask half the gap on either side in the card's colour. The
        // marker keeps its own fill.
        "raymond:border-b-transparent raymond:bg-transparent raymond:[&>:is([data-slot=card-title],[data-slot=card-action])]:bg-card raymond:[&>:is([data-slot=module-marker],[data-slot=card-title],[data-slot=card-action])]:[outline:calc(var(--spacing)*1)_solid_var(--card)]",
        className,
      )}
      {...props}
    >
      <ModuleMarker icon={icon} />
      {children}
    </div>
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-ui-sm font-bold text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("ml-auto flex items-center gap-1", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        // Under raymond the footer is the group box's face, with no rule. On
        // touch it is the touch spacing tall, as a header that holds a target
        // is.
        "flex items-center rounded-b-surface border-t bg-muted px-(--card-spacing) py-2 touch:min-h-touch raymond:border-t-transparent raymond:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  ModuleGrid,
  ModuleMarker,
};
