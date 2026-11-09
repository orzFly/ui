import type * as React from "react";

import { cn } from "../lib/utils.ts";

/** A name or a value from code inside a sentence: a prop, a token, a command's flag. */
function InlineCode({ className, ...props }: React.ComponentProps<"code">) {
  return (
    <code
      data-slot="inline-code"
      // Under raymond the fixed-width face alone, as a help topic sets code,
      // with no chip around it.
      className={cn(
        "rounded-[min(var(--radius-chip),4px)] bg-muted px-1 py-0.5 font-mono text-[0.875em] raymond:bg-transparent raymond:px-0",
        className,
      )}
      {...props}
    />
  );
}

export { InlineCode };
