import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "../lib/utils.ts";
import { Button } from "./button.tsx";
import { ModuleMarker } from "./card.tsx";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  overlay = "dim",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay> & {
  overlay?: "dim" | "clear";
}) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      data-overlay={overlay}
      className={cn(
        "fixed inset-0 z-50 duration-(--duration-overlay) data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        // A clear overlay still catches the outside click, so the page behind
        // stays visible without becoming interactive.
        overlay === "dim" &&
          "bg-scrim supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  overlay = "dim",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
  overlay?: "dim" | "clear";
}) {
  return (
    <SheetPortal>
      <SheetOverlay overlay={overlay} />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          // Laid out as Dialog is: a SheetBody shrinks and scrolls while the
          // title bar, the X and the footer stay put, and a sheet without
          // one, or too short even for those, scrolls whole. Every other
          // child keeps its height. Clipped across: the X's touch hit area
          // reaches past the padding box. A top or bottom sheet stops short
          // of the far edge, so a strip of overlay is still there to tap.
          "fixed z-50 flex flex-col gap-4 overflow-x-hidden overflow-y-auto bg-popover text-ui text-popover-foreground shadow-overlay transition duration-(--duration-sheet) ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:max-h-[85dvh] data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:max-h-[85dvh] data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-sheet data-[side=left]:data-open:slide-in-from-left-sheet data-[side=right]:data-open:slide-in-from-right-sheet data-[side=top]:data-open:slide-in-from-top-sheet data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-sheet data-[side=left]:data-closed:slide-out-to-left-sheet data-[side=right]:data-closed:slide-out-to-right-sheet data-[side=top]:data-closed:slide-out-to-top-sheet [&>:not([data-slot=sheet-body])]:shrink-0",
          // The safe-area insets are transparent borders on the edges the
          // sheet touches, not padding: a className's padding then adds to
          // them instead of replacing them, the background still runs under
          // the notch, and the close button, placed against the padding
          // box, moves clear of it with the content.
          "data-[side=bottom]:border-x-transparent data-[side=bottom]:border-b-transparent data-[side=bottom]:border-r-[length:env(safe-area-inset-right)] data-[side=bottom]:border-b-[length:env(safe-area-inset-bottom)] data-[side=bottom]:border-l-[length:env(safe-area-inset-left)] data-[side=left]:border-y-transparent data-[side=left]:border-l-transparent data-[side=left]:border-t-[length:env(safe-area-inset-top)] data-[side=left]:border-b-[length:env(safe-area-inset-bottom)] data-[side=left]:border-l-[length:env(safe-area-inset-left)] data-[side=right]:border-y-transparent data-[side=right]:border-r-transparent data-[side=right]:border-t-[length:env(safe-area-inset-top)] data-[side=right]:border-r-[length:env(safe-area-inset-right)] data-[side=right]:border-b-[length:env(safe-area-inset-bottom)] data-[side=top]:border-x-transparent data-[side=top]:border-t-transparent data-[side=top]:border-t-[length:env(safe-area-inset-top)] data-[side=top]:border-r-[length:env(safe-area-inset-right)] data-[side=top]:border-l-[length:env(safe-area-inset-left)]",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-3 right-3"
              size="icon-sm"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  );
}

/** The part between the header and the footer that scrolls on a short screen. */
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn(
        // Below a few lines a body scrolls nothing usefully, so the sheet
        // scrolls whole instead; calc-size() keeps a shorter body at its own
        // height, and a browser without it lets the body shrink as far as it
        // must.
        "min-h-[calc-size(max-content,min(size,4rem))] overflow-y-auto px-4",
        className,
      )}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

/** The title, after the module marker. */
function SheetTitle({
  className,
  icon,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title> & {
  /** The module marker's icon; omitted, the marker draws ▶. */
  icon?: React.ReactNode;
}) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-title font-medium text-foreground flex items-center gap-2",
        className,
      )}
      {...props}
    >
      <ModuleMarker icon={icon} />
      {children}
    </SheetPrimitive.Title>
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-ui text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
