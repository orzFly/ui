"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * Tabs and their panels. `variant="framed"` joins the strip and the panels in one frame, the
 * strip on a `TabsBar` that may carry the module's marker, its name and its own controls beside
 * the tabs: a live example and its source, a sample's states.
 */
// A panel reads its own set's variant: a set nested in a framed one's panel
// is not framed.
const TabsVariantContext = React.createContext<"default" | "framed">("default");

function Tabs({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root> & {
  variant?: "default" | "framed";
}) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-variant={variant}
        className={cn(
          "group/tabs flex flex-col gap-2",
          // Under raymond a framed set is a property sheet: the frame gives way
          // to the raised panel the current tab stands on.
          variant === "framed" &&
            "gap-0 overflow-hidden rounded-surface border raymond:border-transparent raymond:bg-(--3d-face)",
          className,
        )}
        {...props}
      />
    </TabsVariantContext.Provider>
  );
}

/**
 * A framed set's strip: its `TabsList`, and whatever sits beside the tabs on the same ruled bar.
 */
function TabsBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="tabs-bar"
      // Under raymond the bar is the face, its rule the panel's raised top.
      className={cn(
        "flex flex-wrap items-stretch border-b bg-muted raymond:border-b-0 raymond:bg-(--3d-face)",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The tabs' strip. `variant="line"` is for tabs whose panel does not lie directly under them, as
 * in a toolbar over a pane with its own surface: no fill and no separators, the current tab
 * underlined on the strip's rule. Laid flush against the bottom of a ruled bar, its rule lands
 * on the bar's. A strip that may not fit scrolls in an element around it, never on itself: the
 * current tab reaches over the strip's rule, which the strip's own scroller would clip, and a
 * pixel's overflow would give it a vertical scroll bar.
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
        // Under raymond either strip is the face, its rule the lit edge.
        "group/tabs-list inline-flex w-fit items-stretch border-b text-muted-foreground raymond:border-(--3d-highlight) raymond:bg-(--3d-face) raymond:px-0.5 raymond:pt-0.5 raymond:text-foreground",
        variant === "default" ? "bg-muted" : "-mb-px self-stretch",
        // On a framed set's bar the bar draws the rule and the fill; under
        // raymond the panel's top edge is the rule.
        "in-data-[slot=tabs-bar]:border-b-0 in-data-[slot=tabs-bar]:bg-transparent raymond:in-data-[slot=tabs-bar]:-mb-0.5 raymond:in-data-[slot=tabs-bar]:z-1",
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
        // Under raymond each tab, of either strip, is raised from the strip with
        // rounded top corners, and the current one stands two pixels larger
        // every way but down, over its neighbours' edges: raymond has no
        // underlined tab.
        "raymond:mt-0.5 raymond:[--tab-line-cue:var(--tab-cue)] raymond:rounded-t-[3px] raymond:border-0 raymond:[--focus-offset:-3px] raymond:shadow-[inset_1px_1px_var(--3d-highlight),inset_-1px_0_var(--3d-dark-shadow),inset_-2px_0_var(--3d-shadow)] raymond:data-[state=active]:z-1 raymond:data-[state=active]:-mx-0.5 raymond:data-[state=active]:mt-0 raymond:data-[state=active]:bg-(--3d-face) raymond:data-[state=active]:px-[calc(var(--spacing)*3+2px)] raymond:data-[state=active]:shadow-[inset_1px_1px_var(--3d-highlight),inset_-1px_0_var(--3d-dark-shadow),inset_-2px_0_var(--3d-shadow)]",
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
  const framed = React.useContext(TabsVariantContext) === "framed";
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "flex-1 rounded-item outline-none focus-visible:focus-ring",
        // Under raymond a framed set's panel is raised, its top edge the
        // strip's rule.
        framed && "rounded-none raymond:shadow-raised",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger };
