import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * The line under a field, a choice or a switch that says what it is for or what it takes. Give it
 * an `id` and point the control's `aria-describedby` at it.
 */
function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      // Under raymond in the window text, as a dialog's own lines are.
      className={cn(
        "text-ui text-muted-foreground raymond:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/**
 * What is wrong with a field and how to put it right, under it. Give it an `id`, point the
 * control's `aria-describedby` at it, and set `aria-invalid` on the control.
 */
function FieldError({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-error"
      className={cn("text-ui text-destructive", className)}
      {...props}
    />
  );
}

export { FieldDescription, FieldError };
