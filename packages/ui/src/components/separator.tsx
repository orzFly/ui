"use client";

import { Separator as SeparatorPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * What a separator parts, which decides how each style draws it. `group`
 * parts groups that space alone would not set apart: clusters of buttons in a
 * toolbar, sections of a page. `row` parts the rows of one group of controls,
 * a settings screen's switches and pickers.
 */
type SeparatorPurpose = "group" | "row";

// Under raymond a rule is etched: a lit line beside the dark one. The
// period's dialogs part a group's rows by space alone, so a row's rule keeps
// its pixel and draws nothing.
const PURPOSE: Record<SeparatorPurpose, string> = {
  group:
    "raymond:data-horizontal:shadow-[0_1px_var(--3d-highlight)] raymond:data-vertical:shadow-[1px_0_var(--3d-highlight)]",
  row: "raymond:bg-transparent",
};

function Separator({
  purpose = "group",
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root> & {
  purpose?: SeparatorPurpose;
}) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      data-purpose={purpose}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        PURPOSE[purpose],
        className,
      )}
      {...props}
    />
  );
}

export { Separator, type SeparatorPurpose };
