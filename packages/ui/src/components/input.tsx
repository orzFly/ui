import type * as React from "react";

import { cn } from "../lib/utils.ts";

function Input({
  className,
  type,
  flush = false,
  ...props
}: React.ComponentProps<"input"> & {
  /**
   * No frame and no inline padding, for a field whose row draws its edge
   * (a composer's To and Subject). A style that frames every field keeps
   * its frame, and the padding inside it.
   */
  flush?: boolean;
}) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Under raymond a field is always sunken on the window colour, a
        // flush one included, its focus rectangle inside the bevel.
        "h-control w-full min-w-0 rounded-control border border-input bg-field px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-control-xs file:border-0 file:bg-transparent file:text-ui file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:focus-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/10 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-ui dark:bg-input/15 dark:disabled:bg-input/40 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 touch:h-10 touch:text-base raymond:border-transparent raymond:bg-(--window) raymond:bg-clip-padding raymond:shadow-sunken raymond:[--focus-offset:-4px]",
        flush &&
          "border-0 bg-transparent px-0 dark:bg-transparent raymond:my-0.5 raymond:bg-(--window) raymond:px-1",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
