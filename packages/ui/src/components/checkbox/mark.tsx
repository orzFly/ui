import { CheckIcon, MinusIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../../lib/utils.ts";

// Under raymond a sunken well on the window colour, the mark in the window's
// own text colour rather than --foreground, which a highlighted row turns
// white around it: 13px, the check a 7px pixel mark, grey while held down or
// disabled.
// Inline-level, as Radix expects: inside a form it adds a hidden input after
// the box and pulls it back by its own width, which lands on the box only
// when the two share a line. After a block-level box the input drops to the
// line below, out of a table cell and into the table's scroll.
/** A `Checkbox`'s box. */
export const CHECKBOX_BOX =
  "peer relative inline-flex size-4 shrink-0 cursor-pointer align-middle items-center justify-center rounded-[min(var(--radius-control),4px)] border border-input shadow-sunken transition-colors outline-none focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:bg-input/15 dark:aria-invalid:ring-destructive/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground dark:data-[state=indeterminate]:bg-primary touch:hit-area raymond:size-3.25 raymond:border-0 raymond:bg-(--window) raymond:active:bg-(--3d-face) raymond:disabled:bg-(--3d-face) raymond:disabled:opacity-100 raymond:[--input:transparent] raymond:[--primary-foreground:var(--popover-foreground)] raymond:[--primary:var(--window)]";

/** What is inside the box while it is checked or partly checked. */
export const CHECKBOX_INDICATOR =
  "group grid place-content-center text-current [&>svg]:size-3.5 raymond:size-1.75 raymond:data-[state=checked]:[&>svg]:hidden raymond:data-[state=checked]:bg-no-repeat raymond:data-[state=checked]:bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%277%27%20height=%277%27%3E%3Cpath%20d=%27M6%200h1v3H6v1H5v1H4v1H3v1H2V6H1V5H0V2h1v1h1v1h1V3h1V2h1V1h1z%27/%3E%3C/svg%3E')] raymond:[&>svg]:size-1.75 raymond:[&>svg]:stroke-4";

// A size class of their own, which the indicator's outranks: a row that sizes
// every unsized icon it holds (a FilterMenu's) would otherwise outrank the
// indicator and draw them a full 16px, past a raymond box's 7px mark.
const ICON = "size-3.5";

/**
 * A checkbox drawn and not operated: the look of a `Checkbox` in `state`, for
 * a row that is picked as a whole. Hidden from a screen reader, which hears
 * the state from the row.
 */
export function CheckboxMark({
  state,
  className,
}: {
  state: "checked" | "indeterminate" | "unchecked";
  className?: string;
}): React.ReactElement {
  return (
    <span
      aria-hidden
      data-slot="checkbox-mark"
      data-state={state}
      className={cn(
        CHECKBOX_BOX,
        // The row takes the press; `touch:hit-area` reaches past the box and
        // into the rows beside it.
        "pointer-events-none",
        // A disabled row already fades whatever it holds, as a disabled
        // Checkbox fades; under raymond the box greys as Checkbox's does.
        "raymond:group-data-disabled/option:bg-(--3d-face)",
        className,
      )}
    >
      {state !== "unchecked" && (
        <span data-state={state} className={CHECKBOX_INDICATOR}>
          <CheckIcon
            className={cn(ICON, "group-data-[state=indeterminate]:hidden")}
          />
          <MinusIcon
            className={cn(
              ICON,
              "hidden group-data-[state=indeterminate]:block",
            )}
          />
        </span>
      )}
    </span>
  );
}
