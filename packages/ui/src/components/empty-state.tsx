import * as React from "react";

import { cn } from "../lib/utils.ts";

type IconComponent = React.ComponentType<{
  className?: string;
  "aria-hidden"?: boolean;
}>;

/**
 * What stands in a list, a pane or a page that has nothing to show: an icon for the place, a
 * title that says what is missing, `children` saying why or what to do, and `action`, the next
 * step as a button. Place it with `className` (the padding around it, its share of the space).
 *
 * `icon` takes an icon component, drawn at the state's own size and colour, or an element, drawn
 * as it is. `orientation="horizontal"` sets the icon beside the text and the action at the end of
 * the row, for a state that sits among other content rather than filling its space.
 * `tone="destructive"` draws the icon and the title in the destructive colour, for a place that
 * has nothing to show because something failed.
 */
function EmptyState({
  icon,
  title,
  action,
  orientation = "vertical",
  tone = "default",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  icon?: IconComponent | React.ReactElement;
  title: React.ReactNode;
  action?: React.ReactNode;
  orientation?: "vertical" | "horizontal";
  tone?: "default" | "destructive";
}) {
  const horizontal = orientation === "horizontal";
  const destructive = tone === "destructive";
  let visual: React.ReactNode = null;
  if (React.isValidElement(icon)) visual = icon;
  else if (icon) {
    const Icon = icon;
    visual = (
      <Icon
        aria-hidden
        className={cn(
          "shrink-0",
          // Under raymond only the icon turns red, as on a Windows error
          // box: the text stays in the window text.
          destructive
            ? "text-destructive"
            : "text-muted-foreground raymond:text-foreground",
          horizontal ? "size-5" : "size-8",
        )}
      />
    );
  }
  return (
    <div
      data-slot="empty-state"
      data-orientation={orientation}
      data-tone={tone}
      // Under raymond the line an empty list view prints in its well, as
      // Explorer's "This folder is empty": everything in the window text,
      // set closer together.
      className={cn(
        horizontal
          ? "flex flex-wrap items-center gap-x-3 gap-y-2 raymond:gap-x-2"
          : "grid justify-items-center gap-2 text-center raymond:gap-1",
        className,
      )}
      {...props}
    >
      {visual}
      <div
        className={
          horizontal
            ? "grid min-w-0 flex-1 basis-48 gap-0.5 raymond:gap-0"
            : "contents"
        }
      >
        <p
          data-slot="empty-state-title"
          className={cn(
            "font-medium",
            horizontal && "text-ui",
            destructive && "text-destructive raymond:text-foreground",
          )}
        >
          {title}
        </p>
        {children && (
          <p
            data-slot="empty-state-description"
            className={cn(
              "text-muted-foreground raymond:text-foreground",
              horizontal ? "text-ui-sm" : "text-ui",
            )}
          >
            {children}
          </p>
        )}
      </div>
      {action && (
        <div
          data-slot="empty-state-action"
          className={cn("flex gap-2", !horizontal && "mt-2")}
        >
          {action}
        </div>
      )}
    </div>
  );
}

export { EmptyState };
