import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * How a `LinkCard` sits among its neighbours: `card` framed on its own (the page before and after
 * this one, the demos that show it), `row` one ruled line of a list of pages, its description
 * beside the title from `sm` up.
 */
type LinkCardVariant = "card" | "row";

// Under raymond a link to another page is what HTML Help and a folder's web
// view draw: no frame, rule or fill, the title underlined in the link colour,
// the rest in the window text, and the dotted focus rectangle around it all.
const VARIANT: Record<LinkCardVariant, string> = {
  card: "flex min-h-11 flex-col gap-1 rounded-surface border px-4 py-3 text-prose [&_[data-slot=link-card-description]]:leading-prose-sm",
  row: "grid min-h-row gap-x-6 gap-y-0.5 border-b px-2 py-2 text-prose-sm sm:grid-cols-[11rem_1fr] touch:min-h-11 [li:first-child>&]:border-t",
};

/**
 * A link to another page, set in running prose: its `LinkCardTitle`, then a `LinkCardDescription`
 * saying what is there, and a `LinkCardLabel` above the title where the card needs one ("Next").
 * `asChild` renders a router's link.
 */
function LinkCard({
  variant = "card",
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  variant?: LinkCardVariant;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "a";
  return (
    <Comp
      data-slot="link-card"
      data-variant={variant}
      className={cn(
        "group/link-card transition-colors outline-none hover:bg-accent focus-visible:focus-ring",
        VARIANT[variant],
        "raymond:border-transparent raymond:px-1 raymond:py-1 raymond:transition-none raymond:hover:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

/** The page's name. */
function LinkCardTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="link-card-title"
      className={cn(
        "font-medium raymond:font-normal raymond:text-link raymond:underline",
        className,
      )}
      {...props}
    />
  );
}

/** What the page holds, or where in it to look. */
function LinkCardDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="link-card-description"
      className={cn(
        "text-prose-sm text-muted-foreground raymond:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** A word above the title that says how the page relates to this one, with its arrow. */
function LinkCardLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="link-card-label"
      className={cn(
        "flex items-center gap-1 text-prose-xs text-muted-foreground raymond:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export {
  LinkCard,
  LinkCardDescription,
  LinkCardLabel,
  LinkCardTitle,
  type LinkCardVariant,
};
