import type * as React from "react";

import { cn } from "../lib/utils.ts";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-control w-full min-w-0 rounded-control border border-input bg-field px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-control-xs file:border-0 file:bg-transparent file:text-ui file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:focus-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/10 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-ui dark:bg-input/15 dark:disabled:bg-input/40 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 touch:h-10 touch:text-base",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
