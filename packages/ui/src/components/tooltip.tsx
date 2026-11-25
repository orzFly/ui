"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 2,
  children,
  container,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & {
  /** Where the tooltip is portalled. Default `document.body`; an element in fullscreen needs its own. */
  container?: React.ComponentProps<typeof TooltipPrimitive.Portal>["container"];
}) {
  return (
    <TooltipPrimitive.Portal container={container}>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          // Under raymond a tooltip is in the info colours, framed in its
          // text colour, with no arrow (hidden rather than undisplayed: Radix
          // writes the arrow's display inline).
          "z-50 inline-flex w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) items-center gap-1.5 rounded-[min(var(--radius-overlay),8px)] bg-foreground px-3 py-1.5 text-ui-sm text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-overlay data-[side=left]:slide-in-from-right-overlay data-[side=right]:slide-in-from-left-overlay data-[side=top]:slide-in-from-bottom-overlay **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-[min(var(--radius-chip),6px)] data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-(--overlay-zoom) data-open:animate-in data-open:fade-in-0 data-open:zoom-in-(--overlay-zoom) data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-(--overlay-zoom) raymond:border raymond:border-(--info-foreground) raymond:bg-(--info) raymond:px-1 raymond:py-px raymond:text-(--info-foreground) raymond:shadow-none",
          className,
        )}
        {...props}
      >
        {children}
        {/* 2px overlap into the content box prevents subpixel hairline gaps at fractional DPRs (1.25x, 1.5x, 1.75x) on all four sides. */}
        <TooltipPrimitive.Arrow asChild width={10} height={7}>
          <svg
            aria-hidden="true"
            width={10}
            height={7}
            viewBox="0 0 10 7"
            className="block -translate-y-0.5 fill-foreground raymond:invisible"
          >
            <path d="M0 0 H10 V2 L5 7 L0 2 Z" />
          </svg>
        </TooltipPrimitive.Arrow>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
