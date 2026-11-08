import type * as React from "react";

import { cn } from "../lib/utils.ts";
import { Button } from "./button.tsx";
import { Separator } from "./separator.tsx";

/**
 * A command in a toolbar: a ghost button, an icon alone (`size="icon"`, the
 * default, named with `aria-label`) or an icon with its text beside it. A
 * style redraws it in place, never re-laid out: raymond keeps it flat until
 * the pointer raises it by one pixel, and sinks it while held or open, as
 * Windows 2000's toolbars do.
 */
function ToolbarButton({
  size = "icon",
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "variant">) {
  return (
    <Button
      variant="ghost"
      size={size}
      data-slot="toolbar-button"
      className={cn(
        "raymond:border-0 raymond:hover:bg-transparent raymond:hover:shadow-[inset_1px_1px_var(--3d-highlight),inset_-1px_-1px_var(--3d-shadow)] raymond:active:translate-y-0 raymond:active:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)] raymond:aria-expanded:bg-transparent raymond:aria-expanded:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)]",
        className,
      )}
      {...props}
    />
  );
}

/** A rule between groups of commands, etched under raymond. */
function ToolbarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      orientation="vertical"
      data-slot="toolbar-separator"
      className={cn("mx-1 h-5", className)}
      {...props}
    />
  );
}

export { ToolbarButton, ToolbarSeparator };
