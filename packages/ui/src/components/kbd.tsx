import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * A key to press, as a keycap: the `/` hint in a search box, a row of a shortcuts list. Write
 * the key as it is printed on the keyboard (`Esc`, `⇧`, `E`).
 */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      // Under raymond a key is written as the period's menus write a
      // shortcut: the key's name in the window text, with no cap around it.
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[min(var(--radius-control),4px)] border bg-muted px-1 font-mono text-ui-xs text-muted-foreground raymond:min-w-0 raymond:border-transparent raymond:bg-transparent raymond:px-0 raymond:font-ui raymond:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
