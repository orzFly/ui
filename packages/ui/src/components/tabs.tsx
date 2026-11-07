"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

/**
 * The tabs' strip. `variant="line"` is for tabs whose panel does not lie directly under them, as
 * in a toolbar over a pane with its own surface: no fill and no separators, the current tab
 * underlined on the strip's rule. Laid flush against the bottom of a ruled bar, its rule lands
 * on the bar's.
 */
function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
  variant?: "default" | "line";
}) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        "group/tabs-list inline-flex w-fit items-stretch border-b text-muted-foreground",
        variant === "default" ? "bg-muted" : "-mb-px self-stretch",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative -mb-px inline-flex min-h-control items-center justify-center gap-1.5 rounded-item px-3 touch:min-h-10 text-ui font-medium whitespace-nowrap transition-colors outline-none focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground touch:hit-area",
        // The current tab is a box in the page's colour that covers the list's
        // bottom rule, so it joins the content below, with a primary edge
        // across its top; the fill alone would not hold 3:1 on the strip.
        "group-data-[variant=default]/tabs-list:border-r group-data-[variant=default]/tabs-list:border-border/60 group-data-[variant=default]/tabs-list:first:border-l group-data-[variant=default]/tabs-list:data-[state=active]:bg-background group-data-[variant=default]/tabs-list:data-[state=active]:tab-cue",
        // A line's current tab has nothing to join, so it is underlined.
        "group-data-[variant=line]/tabs-list:hover:text-foreground group-data-[variant=line]/tabs-list:data-[state=active]:tab-line-cue",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "flex-1 rounded-item outline-none focus-visible:focus-ring",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
