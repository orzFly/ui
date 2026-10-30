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
        // The edge is a ring, drawn outside the box, so two cards laid edge to
        // edge paint one shared line rather than two.
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-surface bg-card py-(--card-spacing) text-ui text-card-foreground ring-1 ring-border [--card-spacing:--spacing(3)] has-[>[data-slot=card-header]]:pt-0 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(2)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-surface *:[img:last-child]:rounded-b-surface",
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
  /** An icon, sized and stroked by the marker; omitted, the marker draws ▶. */
  icon?: React.ReactNode;
}) {
  return (
    <span
      data-slot="module-marker"
      aria-hidden="true"
      className={cn(
        "inline-grid size-4 shrink-0 place-items-center bg-marker text-primary [&_svg:not([data-play])]:size-[11px] [&_svg:not([data-play])]:stroke-[2.4]",
        className,
      )}
      {...props}
    >
      {icon ?? (
        <svg
          data-play=""
          aria-hidden="true"
          width="7"
          height="9"
          viewBox="0 0 7 9"
          fill="currentColor"
          className="ml-px"
        >
          <path d="M0 0 7 4.5 0 9z" />
        </svg>
      )}
    </span>
  );
}

/**
 * The card's header: a ruled strip holding the module marker, then the title,
 * the description and the action.
 */
function CardHeader({
  className,
  icon,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  /** The module marker's icon; omitted, the marker draws ▶. */
  icon?: React.ReactNode;
}) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header flex min-h-row flex-wrap items-center gap-x-2 gap-y-0.5 border-b bg-muted px-2 py-0.5 text-ui-sm",
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

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-ui-sm text-muted-foreground", className)}
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
        "flex items-center rounded-b-surface border-t bg-muted p-(--card-spacing)",
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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  ModuleMarker,
};
