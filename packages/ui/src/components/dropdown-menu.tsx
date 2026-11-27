import { CheckIcon, ChevronRightIcon, MinusIcon } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive, Slot } from "radix-ui";
import type * as React from "react";
import { createContext, useContext, useRef, useState } from "react";
import { isModifiedClick } from "../lib/link.ts";
import { cn } from "../lib/utils.ts";
import { ChoiceMark, MARK_ROOM, MarkPlace } from "./dropdown-menu/mark.tsx";

const OpenContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

// Held here rather than left to Radix so the trigger can open the menu from a
// click, which Radix's own trigger never does.
function DropdownMenu({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };
  return (
    <OpenContext.Provider value={{ open, setOpen }}>
      <DropdownMenuPrimitive.Root
        data-slot="dropdown-menu"
        open={open}
        onOpenChange={setOpen}
        {...props}
      />
    </OpenContext.Provider>
  );
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  );
}

function DropdownMenuTrigger({
  onPointerDown,
  onClick,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  const context = useContext(OpenContext);
  // What the deferred tap should leave the menu as, decided at pointerdown:
  // an open menu is dismissed by that same pointerdown landing outside it,
  // and by click time `open` already reads false.
  const deferred = useRef<boolean | null>(null);
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      onPointerDown={(event) => {
        onPointerDown?.(event);
        deferred.current = null;
        if (event.defaultPrevented || context === null) return;
        // Radix opens on pointerdown, and a finger lands on a trigger at the
        // start of every scroll that crosses one. Wait for the click, which
        // the browser withholds once the touch has become a scroll.
        // preventDefault() is what makes Radix skip its own half; on a touch
        // pointerdown it suppresses only the emulated mouse events.
        if (event.pointerType === "touch" || event.pointerType === "pen") {
          deferred.current = !context.open;
          event.preventDefault();
        }
      }}
      onClick={(event) => {
        onClick?.(event);
        const next = deferred.current;
        deferred.current = null;
        if (next === null || event.defaultPrevented || props.disabled) return;
        if (context !== null && context.open !== next) context.setOpen(next);
      }}
      {...props}
    />
  );
}

function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 4,
  // Radix defaults to sticky="partial", whose limiter keeps the menu glued to
  // the trigger and lets it follow the trigger out of the viewport — the menu
  // then renders half off-screen with visibility still "visible", so nothing
  // else catches it. "always" trades staying glued for staying reachable.
  sticky = "always",
  collisionPadding = 8,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        sticky={sticky}
        collisionPadding={collisionPadding}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          const content = event.currentTarget;
          const id =
            content instanceof HTMLElement
              ? content.getAttribute("aria-labelledby")
              : null;
          const trigger = id === null ? null : document.getElementById(id);
          // Without a trigger to hand the focus to, fall through to Radix's own
          // restore rather than preventDefault() into a focusless document.
          if (trigger === null) return;
          event.preventDefault();
          // Radix restores focus with a bare focus(), which lets the browser
          // scroll the trigger back into view — obeying the scroll-padding
          // useScrollInsets writes on <html>, so the page can travel a full
          // document height. preventScroll keeps the restore invisible.
          trigger.focus({ preventScroll: true });
        }}
        className={cn(
          // Two separate caps, and the smaller has to win: the Radix variable
          // keeps the menu off its own anchor, while the viewport term is what
          // survives an anchor sitting outside the viewport, where that
          // variable resolves to the whole viewport height. min() is the only
          // spelling that keeps both — two max-h utilities collapse to one in
          // cn(), and two max-height declarations would settle by cascade
          // order rather than by value. dvh, because the term that matters is
          // the one the mobile address bar moves.
          "z-50 max-h-[min(calc(100dvh-1rem),var(--radix-dropdown-menu-content-available-height,100dvh))] w-(--radix-dropdown-menu-trigger-width) min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-overlay bg-popover p-1 text-popover-foreground shadow-menu ring-1 ring-border duration-(--duration-overlay) transition-none raymond:ring-0 data-[side=bottom]:slide-in-from-top-overlay data-[side=left]:slide-in-from-right-overlay data-[side=right]:slide-in-from-left-overlay data-[side=top]:slide-in-from-bottom-overlay data-[state=closed]:overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-(--overlay-zoom) data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-(--overlay-zoom)",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  );
}

/**
 * An item that is a link (`asChild` around an `a[href]`) goes as a link
 * does. A plain click goes and closes the menu, even when the link's own
 * `onClick` handled it in place and prevented its default, which Radix
 * reads as "keep the menu open". A click with a modifier is the browser's (a
 * new tab, a window, a download), and the menu stays open for the next one.
 */
function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  onClick,
  onSelect,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  const context = useContext(OpenContext);
  // Whether the click being handled is a plain one on a link: set in the
  // click, read in the select Radix dispatches from inside that same click.
  const linkClick = useRef<"plain" | "modified" | null>(null);
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        // The destructive label mixes in --foreground as Button's destructive
        // variant does: bare text-destructive on its highlight tint measured
        // 3.44-4.47:1 in 19 of the 38 palettes. The icon keeps bare
        // --destructive, which clears the 3:1 an icon needs.
        // test/destructive-contrast.test.ts pins both. Under raymond this
        // and every other item highlights in the highlight colour, the
        // palette's primary; accent stays the soft fill an app's rows use.
        // A destructive item is drawn as any other, as Button's destructive
        // is: the wording carries the danger.
        "group/dropdown-menu-item relative flex cursor-default items-center gap-1.5 rounded-item px-1.5 py-1 text-ui min-h-row touch:min-h-touch raymond:py-0.5 raymond:touch:py-1 outline-hidden select-none raymond:[--accent-foreground:var(--primary-foreground)] raymond:[--accent:var(--primary)] data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:state-cue not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-[color-mix(in_oklab,var(--destructive),var(--foreground)_65%)] data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-[color-mix(in_oklab,var(--destructive),var(--foreground)_65%)] dark:data-[variant=destructive]:data-highlighted:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 raymond:data-disabled:opacity-100 raymond:data-disabled:text-(--3d-shadow) raymond:data-disabled:[text-shadow:1px_1px_var(--3d-highlight)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive raymond:data-[variant=destructive]:text-foreground raymond:data-[variant=destructive]:*:[svg]:text-current raymond:data-[variant=destructive]:data-highlighted:bg-accent raymond:data-[variant=destructive]:data-highlighted:text-accent-foreground raymond:data-[variant=destructive]:data-highlighted:**:text-accent-foreground",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.currentTarget.matches("a[href]")) {
          linkClick.current = null;
          return;
        }
        const plain = !isModifiedClick(event);
        linkClick.current = plain ? "plain" : "modified";
        // Radix selects, and so closes, only a click left to it.
        if (plain && event.defaultPrevented) context?.setOpen(false);
      }}
      onSelect={(event) => {
        onSelect?.(event);
        if (linkClick.current === "modified") event.preventDefault();
        linkClick.current = null;
      }}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-item py-1 pr-8 pl-1.5 text-ui min-h-row touch:min-h-touch raymond:py-0.5 raymond:pr-2 raymond:pl-6 raymond:touch:py-1 outline-hidden select-none raymond:[--accent-foreground:var(--primary-foreground)] raymond:[--accent:var(--primary)] data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:state-cue data-highlighted:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 raymond:data-disabled:opacity-100 raymond:data-disabled:text-(--3d-shadow) raymond:data-disabled:[text-shadow:1px_1px_var(--3d-highlight)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center raymond:right-auto raymond:left-1.5"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        {/* Radix shows the indicator for "indeterminate" too, so a mixed
            item would otherwise wear the same check as a set one. */}
        <DropdownMenuPrimitive.ItemIndicator>
          {checked === "indeterminate" ? <MinusIcon /> : <CheckIcon />}
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-item py-1 pl-1.5 text-ui min-h-row touch:min-h-touch raymond:py-0.5 raymond:touch:py-1 outline-hidden select-none raymond:[--accent-foreground:var(--primary-foreground)] raymond:[--accent:var(--primary)] data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:state-cue data-highlighted:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 raymond:data-disabled:opacity-100 raymond:data-disabled:text-(--3d-shadow) raymond:data-disabled:[text-shadow:1px_1px_var(--3d-highlight)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        MARK_ROOM,
        className,
      )}
      {...props}
    >
      <MarkPlace slot="dropdown-menu-radio-item-indicator">
        <DropdownMenuPrimitive.ItemIndicator>
          <ChoiceMark />
        </DropdownMenuPrimitive.ItemIndicator>
      </MarkPlace>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-1.5 py-1 text-ui-sm font-medium text-muted-foreground data-inset:pl-7",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn(
        // Under raymond an etched line, as a Separator's.
        "-mx-1 my-1 h-px bg-border raymond:-mx-px raymond:shadow-[0_1px_var(--3d-highlight)]",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-ui-sm tracking-widest text-muted-foreground group-data-highlighted/dropdown-menu-item:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default items-center gap-1.5 rounded-item px-1.5 py-1 text-ui min-h-row touch:min-h-touch raymond:py-0.5 raymond:touch:py-1 outline-hidden select-none raymond:[--accent-foreground:var(--primary-foreground)] raymond:[--accent:var(--primary)] focus:bg-accent focus:text-accent-foreground focus:state-cue not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-open:bg-accent data-open:text-accent-foreground data-open:state-cue [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {/* Slottable, so `asChild` callers keep working: Slot takes exactly one
          child, and the arrow beside `children` would be a second one. Wrapped,
          the arrow renders inside whatever element the caller passes in. */}
      <Slot.Slottable>{children}</Slot.Slottable>
      {/* Under raymond the arrow is a solid triangle, as the period's menus draw it. */}
      <ChevronRightIcon className="ml-auto raymond:hidden" />
      <span
        aria-hidden
        className="ml-auto hidden border-y-4 border-l-4 border-y-transparent border-l-current raymond:block"
      />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  // MenuSubContent hardwires `side` after spreading these through, but both
  // land on the popper underneath. No onCloseAutoFocus override to match
  // DropdownMenuContent's: it hardwires that one to preventDefault(), so the
  // scrolling focus restore never happens here.
  sticky = "always",
  collisionPadding = 8,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      sticky={sticky}
      collisionPadding={collisionPadding}
      className={cn(
        // A submenu is the one surface the collision middleware cannot rescue:
        // MenuSubContent hardwires side="right", and Radix configures shift
        // with crossAxis: false, so horizontal overflow is never shifted away.
        // flip moves it to the left of the parent menu and it overflows there
        // instead. Capping the width to what the chosen side actually offers
        // is the only lever a prop or a class has on that axis.
        //
        // overflow-y-auto rather than the plain overflow-hidden this used to
        // carry: a height cap with the overflow clipped only hides the items
        // it cuts off, which is the symptom being fixed rather than a fix.
        "z-50 max-h-[calc(100dvh-1rem)] max-w-[min(calc(100dvw-1rem),var(--radix-dropdown-menu-content-available-width,100dvw))] min-w-[96px] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-overlay bg-popover p-1 text-popover-foreground shadow-overlay ring-1 ring-border raymond:ring-0 duration-(--duration-overlay) transition-none data-[side=bottom]:slide-in-from-top-overlay data-[side=left]:slide-in-from-right-overlay data-[side=right]:slide-in-from-left-overlay data-[side=top]:slide-in-from-bottom-overlay data-open:animate-in data-open:fade-in-0 data-open:zoom-in-(--overlay-zoom) data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-(--overlay-zoom)",
        className,
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
