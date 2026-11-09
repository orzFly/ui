import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * A link inside a sentence, underlined and in the link colour. `asChild` renders a router's link.
 * A link that stands on its own line with a description is a `LinkCard`; one that acts rather than
 * goes somewhere is a `Button`.
 */
function TextLink({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a";
  return (
    <Comp
      data-slot="text-link"
      // Under raymond in regular weight, as a web view's links are.
      className={cn(
        "font-medium text-link underline underline-offset-4 outline-none focus-visible:focus-ring raymond:font-normal",
        className,
      )}
      {...props}
    />
  );
}

export { TextLink };
