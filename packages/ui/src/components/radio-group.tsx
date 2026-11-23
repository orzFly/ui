import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * Picks exactly one of a few options, all of them in view at once. The arrow
 * keys move between options.
 */
function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      // On touch the rows stand 44px apart, the gap what the style's radio
      // leaves of it: 16px by default, 12px under raymond.
      className={cn(
        "grid gap-3 touch:gap-7 raymond:gap-1 raymond:touch:gap-8",
        className,
      )}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        // Under raymond a sunken well on the window colour, the mark in the
        // window's own text colour rather than --foreground, which a
        // highlighted row turns white around it: 12px with a 4px dot, the
        // options at a dialog's pitch, grey while held down or disabled.
        // Inline-level, as Checkbox is, so the hidden input Radix adds inside
        // a form lands on the radio rather than on the line below it.
        "peer relative inline-flex aspect-square size-4 shrink-0 cursor-pointer align-middle items-center justify-center rounded-full border border-input shadow-sunken transition-colors outline-none focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:bg-input/15 dark:aria-invalid:ring-destructive/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary dark:data-[state=checked]:bg-primary touch:hit-area raymond:size-3 raymond:border-0 raymond:bg-(--window) raymond:active:bg-(--3d-face) raymond:disabled:bg-(--3d-face) raymond:disabled:opacity-100 raymond:[--input:transparent] raymond:[--primary-foreground:var(--popover-foreground)] raymond:[--primary:var(--window)]",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="size-2 rounded-full bg-primary-foreground raymond:size-1"
      />
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
