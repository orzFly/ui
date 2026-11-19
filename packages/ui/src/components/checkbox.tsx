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
        "peer relative flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[min(var(--radius-control),4px)] border border-input shadow-sunken transition-colors outline-none focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:bg-input/15 dark:aria-invalid:ring-destructive/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground dark:data-[state=indeterminate]:bg-primary touch:hit-area raymond:size-3.25 raymond:border-0 raymond:bg-(--window) raymond:active:bg-(--3d-face) raymond:disabled:bg-(--3d-face) raymond:disabled:opacity-100 raymond:[--input:transparent] raymond:[--primary-foreground:var(--popover-foreground)] raymond:[--primary:var(--window)]",
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

/**
 * A row's checkbox in its icon's own cell. The icon stands for "not selected" and gives way to
 * the box while it is checked or partly checked, while `revealed` (the pointer on the row, say),
 * while it has the keyboard's focus, and on touch once an ancestor marked `data-selecting` holds
 * a selection. Hidden, the box still takes a press and the focus, so a tap or a click on the
 * icon selects. Without an `icon` the cell stays empty until then.
 */
function SelectSlot({
  icon,
  revealed = false,
  className,
  ...props
}: React.ComponentProps<typeof Checkbox> & {
  icon?: React.ReactNode;
  revealed?: boolean;
}) {
  return (
    <span
      data-slot="select-slot"
      data-revealed={revealed ? "" : undefined}
      className="group/select-slot inline-grid size-4 shrink-0 place-items-center *:[grid-area:1/1]"
    >
      {icon !== undefined && (
        <span
          aria-hidden
          data-slot="select-slot-icon"
          className="inline-grid place-items-center group-data-revealed/select-slot:opacity-0 group-has-focus-visible/select-slot:opacity-0 group-has-data-[state=checked]/select-slot:opacity-0 group-has-data-[state=indeterminate]/select-slot:opacity-0 touch:in-data-selecting:opacity-0"
        >
          {icon}
        </span>
      )}
      {/* Faded rather than hidden: a hidden box would take neither the focus nor a press. */}
      <Checkbox
        className={cn(
          "opacity-0 group-data-revealed/select-slot:opacity-100 focus-visible:opacity-100 data-[state=checked]:opacity-100 data-[state=indeterminate]:opacity-100 touch:in-data-selecting:opacity-100",
          className,
        )}
        {...props}
      />
    </span>
  );
}

export { Checkbox, SelectSlot };
