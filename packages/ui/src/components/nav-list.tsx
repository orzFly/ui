import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * A column of places to go: an app's folders, a settings screen's sections, a document's parts.
 * Rows tile with no gap; the current one takes the state fill and the state cue. Put it in a
 * `nav` named with `aria-label`, and head each group with a `NavListHeading`.
 */
function NavList({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="nav-list"
      className={cn("flex flex-col", className)}
      {...props}
    />
  );
}

function NavListItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="nav-list-item" className={className} {...props} />;
}

/**
 * One place. `current` marks the place on screen and sets `aria-current`, `"page"` unless given
 * another token (`"location"` for a part of the document in view). `asChild` renders a router's
 * link, or a `button` for a place that is app state rather than a URL. `depth` indents a nested
 * place one step per level. Lead with an icon and end with a `NavListCount` as needed.
 */
/** One step of indent per level of nesting, past the row's own padding. */
const indent = (depth: number, style: React.CSSProperties | undefined) =>
  depth > 0
    ? { paddingLeft: `calc(var(--spacing) * ${3 + depth * 4})`, ...style }
    : style;

function NavListLink({
  className,
  current,
  depth = 0,
  asChild = false,
  style,
  ...props
}: React.ComponentProps<"a"> & {
  current?: boolean | "page" | "location" | "true";
  depth?: number;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "a";
  return (
    <Comp
      data-slot="nav-list-link"
      data-current={current ? "" : undefined}
      aria-current={current === true ? "page" : current || undefined}
      style={indent(depth, style)}
      className={cn(
        "relative flex min-h-row w-full items-center gap-2 px-3 text-left text-ui text-muted-foreground transition-colors outline-none select-none hover:bg-accent hover:text-accent-foreground focus-visible:focus-ring-inset touch:min-h-11 data-current:bg-accent data-current:font-medium data-current:text-accent-foreground data-current:state-cue [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Under raymond the rows are a tree's or a list box's: black on the
        // well with no hover, the current one filled with the highlight, its
        // quiet text and a primary mark inside swapped onto it as List's are.
        "raymond:text-foreground raymond:transition-none raymond:not-data-current:hover:bg-transparent raymond:not-data-current:hover:text-foreground raymond:data-current:bg-primary raymond:data-current:font-normal raymond:data-current:text-primary-foreground raymond:data-current:[--foreground:var(--primary-foreground)] raymond:data-current:[--muted-foreground:var(--primary-foreground)] raymond:data-current:[--list-highlight:var(--primary)] raymond:data-current:[--list-highlight-text:var(--primary-foreground)] raymond:data-current:*:[--primary:var(--list-highlight-text)] raymond:data-current:*:[--primary-foreground:var(--list-highlight)]",
        className,
      )}
      {...props}
    />
  );
}

/** A place's count, unread or waiting, at the row's end. */
function NavListCount({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="nav-list-count"
      className={cn(
        "ml-auto text-ui-sm font-normal tabular-nums text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A group's heading, above the `NavList` it names. `asChild` renders the heading element the
 * page's outline needs (`h2`, `h3`); a link inside it, to the group's own page, underlines
 * on hover. `depth` indents it with the places it heads.
 */
function NavListHeading({
  className,
  depth = 0,
  asChild = false,
  style,
  ...props
}: React.ComponentProps<"div"> & { depth?: number; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="nav-list-heading"
      style={indent(depth, style)}
      className={cn(
        "flex min-h-row items-end px-3 pt-3 pb-1 text-ui-sm font-semibold text-foreground [&_a]:underline-offset-4 [&_a:hover]:underline raymond:font-bold",
        className,
      )}
      {...props}
    />
  );
}

export { NavList, NavListCount, NavListHeading, NavListItem, NavListLink };
