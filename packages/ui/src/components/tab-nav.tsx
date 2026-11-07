import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * A row of links to an app's sections, drawn as a line of tabs: the current one is underlined
 * on the row's rule. Laid flush against the bottom of a ruled header, its rule lands on the
 * header's. Name it with `aria-label`, as any `nav`.
 */
function TabNav({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="tab-nav"
      className={cn(
        "-mb-px flex items-stretch self-stretch border-b",
        className,
      )}
      {...props}
    />
  );
}

/**
 * One section's link. `current` marks the section the reader is in, which need not be the
 * linked page itself; it sets `aria-current`, `"page"` unless given another token. `asChild`
 * renders a router's link in its place.
 */
function TabNavLink({
  className,
  current,
  asChild = false,
  ...props
}: React.ComponentProps<"a"> & {
  current?: boolean | "page" | "location";
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "a";
  return (
    <Comp
      data-slot="tab-nav-link"
      data-current={current ? "" : undefined}
      aria-current={current === true ? "page" : current || undefined}
      className={cn(
        "relative inline-flex min-h-control items-center gap-1.5 px-3 text-ui font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:focus-ring touch:min-h-10 touch:hit-area data-current:text-foreground data-current:tab-line-cue [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}

export { TabNav, TabNavLink };
