import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * The title of a group of controls on a form or a settings screen, above the rows it names.
 * `asChild` renders the heading element the page's outline needs (`h3`). A group that wants a
 * frame of its own is a `Card` instead.
 */
function GroupHeading({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="group-heading"
      // Under raymond the open group box of the period's dialogs: the
      // caption in the window text, an etched line running on from it to
      // the group's edge, and no frame below.
      className={cn(
        "text-ui-sm font-medium text-muted-foreground raymond:flex raymond:items-center raymond:gap-1 raymond:font-normal raymond:text-foreground raymond:after:h-px raymond:after:flex-1 raymond:after:bg-(--3d-shadow) raymond:after:shadow-[0_1px_var(--3d-highlight)] raymond:after:content-['']",
        className,
      )}
      {...props}
    />
  );
}

/** A line under a `GroupHeading` that says what the group is for. */
function GroupDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="group-description"
      // Under raymond in the window text, as GroupHeading's caption is.
      className={cn(
        "text-ui text-muted-foreground raymond:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { GroupDescription, GroupHeading };
