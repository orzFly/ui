import { CheckIcon, MinusIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";
import { CHECKBOX_BOX, CHECKBOX_INDICATOR } from "./checkbox/mark.tsx";

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
      className={cn(CHECKBOX_BOX, className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className={CHECKBOX_INDICATOR}
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
