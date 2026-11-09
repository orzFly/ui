import type * as React from "react";

import { cn } from "../lib/utils.ts";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Under raymond a field is sunken on the window colour, which bg-field
        // reads, the bevel drawing its edge in place of the border, as
        // Input's is: focus inside the bevel, no ring when invalid, and a
        // disabled one on the face with grey text.
        "flex field-sizing-content min-h-16 w-full rounded-control border border-input bg-field px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:focus-ring disabled:cursor-not-allowed disabled:bg-input/10 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-ui dark:bg-input/15 dark:disabled:bg-input/40 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 touch:text-base raymond:bg-clip-padding raymond:shadow-sunken raymond:[--input:transparent] raymond:bg-(--window) raymond:[--focus-offset:-4px] raymond:aria-invalid:border-transparent raymond:aria-invalid:ring-0 raymond:disabled:bg-(--3d-face) raymond:disabled:text-(--3d-shadow) raymond:disabled:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
