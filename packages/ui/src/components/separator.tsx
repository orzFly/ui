"use client";

import { Separator as SeparatorPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        // Under raymond a rule is etched: a lit line beside the dark one.
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch raymond:data-horizontal:shadow-[0_1px_var(--3d-highlight)] raymond:data-vertical:shadow-[1px_0_var(--3d-highlight)]",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
