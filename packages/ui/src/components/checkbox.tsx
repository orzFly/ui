import { CheckIcon, MinusIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * Picks an item, or agrees to something, for an action that runs later.
 * `checked="indeterminate"` marks the parent of a partly checked list.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // Under raymond a sunken well on the window colour, the mark in the
        // window's own text colour rather than --foreground, which a
        // highlighted row turns white around it: 13px, the check a 7px pixel
        // mark, grey while held down or disabled.
        "peer relative flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[min(var(--radius-control),4px)] border border-input shadow-sunken transition-colors outline-none focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:bg-input/15 dark:aria-invalid:ring-destructive/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground touch:hit-area raymond:size-3.25 raymond:border-0 raymond:bg-(--window) raymond:active:bg-(--3d-face) raymond:disabled:bg-(--3d-face) raymond:disabled:opacity-100 raymond:[--input:transparent] raymond:[--primary-foreground:var(--popover-foreground)] raymond:[--primary:var(--window)]",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="group grid place-content-center text-current [&>svg]:size-3.5 raymond:size-1.75 raymond:data-[state=checked]:[&>svg]:hidden raymond:data-[state=checked]:bg-no-repeat raymond:data-[state=checked]:bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%277%27%20height=%277%27%3E%3Cpath%20d=%27M6%200h1v3H6v1H5v1H4v1H3v1H2V6H1V5H0V2h1v1h1v1h1V3h1V2h1V1h1z%27/%3E%3C/svg%3E')] raymond:[&>svg]:size-1.75 raymond:[&>svg]:stroke-4"
      >
        <CheckIcon className="group-data-[state=indeterminate]:hidden" />
        <MinusIcon className="hidden group-data-[state=indeterminate]:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
