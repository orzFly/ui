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

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex w-fit items-stretch border-b bg-muted text-muted-foreground",
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
        // The current tab is a box in the page's colour that covers the list's
        // bottom rule, so it joins the content below, with a primary edge
        // across its top; the fill alone would not hold 3:1 on the strip.
        "relative -mb-px inline-flex min-h-control items-center justify-center gap-1.5 rounded-item border-r border-border/60 px-3 first:border-l touch:min-h-10 text-ui font-medium whitespace-nowrap transition-colors outline-none focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:tab-cue touch:hit-area",
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
