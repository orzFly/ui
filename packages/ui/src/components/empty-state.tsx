import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * What stands in a list, a pane or a page that has nothing to show: an icon for the place, a
 * title that says what is missing, `children` saying why or what to do, and `action`, the next
 * step as a button. Place it with `className` (the padding around it, its share of the space).
 */
function EmptyState({
  icon: Icon,
  title,
  action,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="empty-state"
      // Under raymond the line an empty list view prints in its well, as
      // Explorer's "This folder is empty": everything in the window text,
      // set closer together.
      className={cn(
        "grid justify-items-center gap-2 text-center raymond:gap-1",
        className,
      )}
      {...props}
    >
      {Icon && (
        <Icon
          aria-hidden
          className="size-8 text-muted-foreground raymond:text-foreground"
        />
      )}
      <p data-slot="empty-state-title" className="font-medium">
        {title}
      </p>
      {children && (
        <p
          data-slot="empty-state-description"
          className="text-muted-foreground text-ui raymond:text-foreground"
        >
          {children}
        </p>
      )}
      {action && (
        <div data-slot="empty-state-action" className="mt-2 flex gap-2">
          {action}
        </div>
      )}
    </div>
  );
}

export { EmptyState };
