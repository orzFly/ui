import { CheckIcon, ChevronRightIcon, MinusIcon } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive, Slot } from "radix-ui";
import type * as React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { isModifiedClick } from "../lib/link.ts";
import { cn } from "../lib/utils.ts";
import {
  FilterBox,
  finePointer,
  isComposing,
} from "./dropdown-menu/filter-box.tsx";
import { ChoiceMark, MARK_ROOM, MarkPlace } from "./dropdown-menu/mark.tsx";

const OpenContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Whether the menu is open as of the last `setOpen`, ahead of the render it asks for. */
  live: React.RefObject<boolean>;
} | null>(null);

/** From `DropdownMenuSub` to its trigger and content. */
interface SubContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** The pointerType of the last press, or mouse move, on the trigger; null after a key. */
  opener: React.RefObject<string | null>;
  /** Whether its content filters: set by `DropdownMenuSubContent` while it renders with a query. */
  filtered: boolean;
  setFiltered: (filtered: boolean) => void;
  /** The filter box while the submenu is open with one. */
  box: React.RefObject<HTMLInputElement | null>;
  /** What the trigger taking the focus does, set by a filtering content while it is open. */
  triggerFocused: React.RefObject<(() => void) | null>;
}

const SubContext = createContext<SubContextValue | null>(null);

type Highlight = { id: string | null; by: "user" | "hit" };

/** From a filtering `DropdownMenuSubContent` to its rows. */
interface FilterContextValue {
  highlighted: string | null;
  /** `hit` follows the first row as the list changes; `user` stays where keys or the pointer put it. */
  highlight: (id: string | null, by: Highlight["by"]) => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

/**
 * What a row merges onto its Radix item inside a filtering submenu, where
 * the focus stays in the box: the row is an option whose highlight the
 * submenu sets, and the mouse moves that highlight instead of the focus.
 * Outside one it adds no key at all: Radix spreads a row's props after its
 * own `role` and `data-highlighted`, so even an undefined one would win.
 */
function useFilterRow({
  id,
  disabled,
  onPointerMove,
  onPointerLeave,
}: {
  id?: string;
  disabled?: boolean;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLDivElement>;
}) {
  const filter = useContext(FilterContext);
  const own = useId();
  if (filter === null) return null;
  const rowId = id ?? own;
  const highlighted = filter.highlighted === rowId;
  return {
    id: rowId,
    role: "option",
    "aria-selected": highlighted,
    "data-highlighted": highlighted ? "" : undefined,
    // preventDefault() is what makes Radix skip focusing the row, and on
    // leaving it, focusing the submenu: either would take the box's focus.
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      onPointerMove?.(event);
      if (event.defaultPrevented || event.pointerType !== "mouse") return;
      event.preventDefault();
      if (!disabled && !highlighted) filter.highlight(rowId, "user");
    },
    onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => {
      onPointerLeave?.(event);
      if (event.defaultPrevented || event.pointerType !== "mouse") return;
      event.preventDefault();
      if (highlighted) filter.highlight(null, "user");
    },
  } as const;
}

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
  const live = useRef(open);
  useLayoutEffect(() => {
    live.current = open;
  });
  const setOpen = (next: boolean) => {
    live.current = next;
    if (openProp === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };
  return (
    <OpenContext.Provider value={{ open, setOpen, live }}>
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
  const filterRow = useFilterRow(props);
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
      {...filterRow}
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
  const filterRow = useFilterRow(props);
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
      {...filterRow}
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
  const filterRow = useFilterRow(props);
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
      {...filterRow}
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

// Held here rather than left to Radix so a filtering submenu's Escape can
// close it alone, where Radix's closes the whole menu.
function DropdownMenuSub({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  const menu = useContext(OpenContext);
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const setOpen = (next: boolean) => {
    // A plain click on a trigger that is a link closes the whole menu, and
    // Radix then opens the submenu from that same click: drawn, it would
    // flash open over the menu fading out.
    if (next && menu?.live.current === false) return;
    if (openProp === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };
  const opener = useRef<string | null>(null);
  const box = useRef<HTMLInputElement | null>(null);
  const triggerFocused = useRef<(() => void) | null>(null);
  const [filtered, setFiltered] = useState(false);
  return (
    <SubContext.Provider
      value={{
        open,
        setOpen,
        opener,
        filtered,
        setFiltered,
        box,
        triggerFocused,
      }}
    >
      <DropdownMenuPrimitive.Sub
        data-slot="dropdown-menu-sub"
        open={open}
        onOpenChange={setOpen}
        {...props}
      />
    </SubContext.Provider>
  );
}

/** A key that types into a filter box rather than acting in the menu. Space stays Radix's key to open a submenu. */
const typesIntoBox = (event: React.KeyboardEvent) =>
  [...event.key].length === 1 &&
  event.key !== " " &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.altKey &&
  !isComposing(event.nativeEvent);

/**
 * A trigger that is also a place (`asChild` around an `a[href]`) goes there
 * as a `DropdownMenuItem` link does: a plain click goes and closes the whole
 * menu, even when the link's own `onClick` handled it in place, and a click
 * with a modifier is the browser's, the menu staying open. A tap with a
 * finger or a pen opens the submenu and goes nowhere. Hovering, → and Enter
 * open it as on any trigger.
 */
function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  onPointerDown,
  onPointerMove,
  onFocus,
  onKeyDown,
  onClickCapture,
  onClick,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  const sub = useContext(SubContext);
  const menu = useContext(OpenContext);
  // The pointerType of the press the coming click ends; null after a key.
  const pressedWith = useRef<string | null>(null);
  // Whether the click being handled is a tap the capture phase took over.
  const tapped = useRef(false);
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default items-center gap-1.5 rounded-item px-1.5 py-1 text-ui min-h-row touch:min-h-touch raymond:py-0.5 raymond:touch:py-1 outline-hidden select-none raymond:[--accent-foreground:var(--primary-foreground)] raymond:[--accent:var(--primary)] focus:bg-accent focus:text-accent-foreground focus:state-cue not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-open:bg-accent data-open:text-accent-foreground data-open:state-cue data-disabled:pointer-events-none data-disabled:opacity-50 raymond:data-disabled:opacity-100 raymond:data-disabled:text-(--3d-shadow) raymond:data-disabled:[text-shadow:1px_1px_var(--3d-highlight)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
      // Only while it filters: Radix spreads these props after its own
      // aria-haspopup="menu", so an undefined one would remove it.
      {...(sub?.filtered ? { "aria-haspopup": "dialog" as const } : {})}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        pressedWith.current = event.pointerType;
        if (sub !== null) sub.opener.current = event.pointerType;
      }}
      onClickCapture={(event) => {
        onClickCapture?.(event);
        const by = pressedWith.current;
        tapped.current = false;
        if (
          (by !== "touch" && by !== "pen") ||
          sub === null ||
          props.disabled ||
          event.defaultPrevented ||
          isModifiedClick(event) ||
          !event.currentTarget.matches("a[href]")
        ) {
          return;
        }
        // Radix opens a submenu only from a hover, which a finger has none
        // of, or a click, which on a link would go first. In the capture
        // phase the click is stopped before the link's own onClick, which a
        // router's link skips once the click is handled.
        event.preventDefault();
        tapped.current = true;
        event.currentTarget.focus({ preventScroll: true });
        if (!sub.open) sub.setOpen(true);
      }}
      onClick={(event) => {
        onClick?.(event);
        const tap = tapped.current;
        tapped.current = false;
        pressedWith.current = null;
        if (tap || props.disabled || !event.currentTarget.matches("a[href]")) {
          return;
        }
        // Radix closes nothing from a trigger's click.
        if (!isModifiedClick(event)) menu?.setOpen(false);
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (event.defaultPrevented || sub === null) return;
        if (event.pointerType === "mouse") sub.opener.current = "mouse";
        // preventDefault() is what makes Radix skip focusing the trigger,
        // which would take the focus back from the box being typed in.
        const box = sub.box.current;
        if (sub.open && box !== null && document.activeElement === box) {
          event.preventDefault();
        }
      }}
      onFocus={(event) => {
        onFocus?.(event);
        if (sub?.open) sub.triggerFocused.current?.();
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        pressedWith.current = null;
        if (sub === null) return;
        sub.opener.current = null;
        const box = sub.box.current;
        if (event.defaultPrevented || !sub.open || box === null) return;
        if (!typesIntoBox(event)) return;
        // The character follows the focus into the box. Stopped here, it
        // never reaches the parent menu, whose jump to a row by its first
        // letter would close the submenu.
        box.focus({ preventScroll: true });
        event.stopPropagation();
      }}
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

type DropdownMenuSubFilterProps =
  | {
      /** The text in the filter box. Controlled. */
      query: string;
      /** Called as the box is typed in, and with "" each time the submenu opens. */
      onQueryChange: (query: string) => void;
      /** Defaults to "Filter…". */
      placeholder?: string;
      /** The box's accessible name. Defaults to "Filter". */
      inputLabel?: string;
      /** Shown where the rows go when there are none. Defaults to FilterMenu's. */
      empty?: (query: string) => React.ReactNode;
    }
  | {
      query?: never;
      onQueryChange?: never;
      placeholder?: never;
      inputLabel?: never;
      empty?: never;
    };

type SubFilter = Extract<DropdownMenuSubFilterProps, { query: string }>;

type SubContentProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.SubContent
>;

/** How long a hover-opened submenu waits, its trigger still focused, before its box takes the focus. */
const FILTER_FOCUS_MS = 500;

/** The rows a filtering submenu's highlight may land on, in order. */
const PICKABLE = '[role="option"]:not([data-disabled])';

const NO_HIGHLIGHT: Highlight = { id: null, by: "user" };

const nothingMatches = (query: string) =>
  query === "" ? "Nothing to pick" : `No matches for "${query}"`;

/** The trigger a submenu is labelled by, which is where its focus goes back to. */
function triggerOf(content: Element | null | undefined) {
  const id = content?.getAttribute("aria-labelledby");
  return id ? document.getElementById(id) : null;
}

/**
 * The props a filtering submenu lays over its content's: the box and the
 * list as its children, and the focus, key and pointer rules that keep the
 * focus in the box. Null for a submenu that does not filter. Its hooks run
 * either way, so a submenu given a query while open keeps its Radix content
 * rather than mounting a new one.
 */
function useSubFilter(filter: SubFilter | null, props: SubContentProps) {
  const sub = useContext(SubContext);
  const open = sub?.open ?? false;
  const setFiltered = sub?.setFiltered;
  const opener = sub?.opener;
  const triggerFocused = sub?.triggerFocused;
  const ownBox = useRef<HTMLInputElement>(null);
  const box = sub?.box ?? ownBox;
  // State, not a ref: Radix mounts the content a render after it opens, and
  // the wait for a resting mouse needs the trigger the content names.
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const listId = useId();
  const [highlight, setHighlight] = useState<Highlight>(NO_HIGHLIGHT);
  // The size it had before the first letter, kept while it is open: fewer
  // rows would shrink it, and a submenu pushed up to fit the screen would
  // then slide back down beside its trigger, the box and caret with it.
  const [lock, setLock] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [none, setNone] = useState(false);
  const [labelledBy, setLabelledBy] = useState<string>();
  // What the last press on the submenu came from: only a mouse drags a link.
  const pressedWith = useRef<string | null>(null);
  const pressing = useRef(false);
  const pressOver = useRef<AbortController | null>(null);
  useEffect(() => () => pressOver.current?.abort(), []);

  const latest = useRef(filter);
  useLayoutEffect(() => {
    latest.current = filter;
  });

  const filtering = filter !== null;
  useLayoutEffect(() => {
    if (!filtering || setFiltered === undefined) return;
    setFiltered(true);
    return () => setFiltered(false);
  }, [filtering, setFiltered]);

  // Before the first frame, so an opening never shows the last filter.
  useLayoutEffect(() => {
    const now = latest.current;
    if (!open || now === null) return;
    setHighlight(NO_HIGHLIGHT);
    setLock(null);
    pressing.current = false;
    if (now.query !== "") now.onQueryChange("");
  }, [open]);

  // The rows are the caller's, so the highlight and the empty state follow
  // them as drawn.
  useLayoutEffect(() => {
    if (list === null) return;
    const rows = [...list.querySelectorAll<HTMLElement>(PICKABLE)];
    if (highlight.by === "hit") {
      const first = rows[0]?.id ?? null;
      if (first !== highlight.id) setHighlight({ id: first, by: "hit" });
    } else if (
      highlight.id !== null &&
      !rows.some((row) => row.id === highlight.id)
    ) {
      setHighlight(NO_HIGHLIGHT);
    }
    const nothing = list.querySelector('[role="option"]') === null;
    if (nothing !== none) setNone(nothing);
    const label =
      list.parentElement?.getAttribute("aria-labelledby") ?? undefined;
    if (label !== labelledBy) setLabelledBy(label);
  });

  // A mouse resting on the trigger means to go on into the submenu; one
  // crossing it on the way to another row does not.
  useEffect(() => {
    if (!open || !filtering || opener === undefined || list === null) return;
    let timer = 0;
    const wait = () => {
      window.clearTimeout(timer);
      const from = triggerOf(list.parentElement);
      const resting = () =>
        opener.current === "mouse" &&
        from !== null &&
        document.activeElement === from;
      if (!resting() || !finePointer(from)) return;
      timer = window.setTimeout(() => {
        if (resting()) box.current?.focus({ preventScroll: true });
      }, FILTER_FOCUS_MS);
    };
    if (triggerFocused) triggerFocused.current = wait;
    wait();
    return () => {
      window.clearTimeout(timer);
      if (triggerFocused) triggerFocused.current = null;
    };
  }, [open, filtering, opener, triggerFocused, box, list]);

  if (filter === null) return null;
  const {
    query,
    onQueryChange,
    placeholder = "Filter…",
    inputLabel = "Filter",
    empty = nothingMatches,
  } = filter;

  const moveTo = (row: HTMLElement | undefined) => {
    if (row === undefined) return;
    setHighlight({ id: row.id, by: "user" });
    row.scrollIntoView?.({ block: "nearest" });
  };

  const onBoxKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const rows = [...(list?.querySelectorAll<HTMLElement>(PICKABLE) ?? [])];
    const at = rows.findIndex((row) => row.id === highlight.id);
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        event.stopPropagation();
        const down = event.key === "ArrowDown";
        if (at < 0) moveTo(down ? rows[0] : rows.at(-1));
        else moveTo(rows[at + (down ? 1 : -1)]);
        return;
      }
      case "Home":
      case "End":
        event.preventDefault();
        event.stopPropagation();
        moveTo(event.key === "Home" ? rows[0] : rows.at(-1));
        return;
      case "Enter":
        event.stopPropagation();
        if (isComposing(event.nativeEvent)) return;
        event.preventDefault();
        if (highlight.id !== null) {
          document.getElementById(highlight.id)?.click();
        }
        return;
      // Radix keeps Tab in the menu, and has seen Escape already.
      case "Tab":
      case "Escape":
        return;
    }
    const input = event.currentTarget;
    const back =
      list?.parentElement?.getAttribute("dir") === "rtl"
        ? "ArrowRight"
        : "ArrowLeft";
    // From the start of the box the arrow back goes on to Radix, which
    // closes the submenu.
    if (
      event.key === back &&
      input.selectionStart === 0 &&
      input.selectionEnd === 0
    ) {
      return;
    }
    // Every other key is the box's. Let through, a letter would jump to a
    // row by its first letter, and the arrow back would close the submenu
    // from the middle of the text.
    event.stopPropagation();
  };

  return {
    role: "dialog",
    // Radix marks its menus vertical, which a dialog is not.
    "aria-orientation": undefined,
    style: {
      ...(lock && {
        minWidth: `min(${lock.width}px, 100dvw - 1rem)`,
        minHeight: `min(${lock.height}px, 100dvh - 1rem)`,
      }),
      ...props.style,
    },
    onFocus: (event: React.FocusEvent<HTMLDivElement>) => {
      props.onFocus?.(event);
      const input = box.current;
      if (event.defaultPrevented || input === null) return;
      if (event.target === input || pressing.current) return;
      if (event.target === event.currentTarget) {
        // Entered from a key. preventDefault() is what makes Radix skip
        // focusing the first row; the highlight lands on it instead.
        event.preventDefault();
        setHighlight({ id: null, by: "hit" });
      } else {
        const row = event.target.closest('[role="option"]');
        if (row !== null && list?.contains(row)) {
          setHighlight({ id: row.id, by: "user" });
        }
      }
      input.focus({ preventScroll: true });
    },
    // Hover only, and only with a fine pointer: the box taking the focus
    // raises an on-screen keyboard over the rows.
    onPointerEnter: (event: React.PointerEvent<HTMLDivElement>) => {
      props.onPointerEnter?.(event);
      if (event.defaultPrevented || event.pointerType !== "mouse") return;
      if (finePointer(event.currentTarget)) {
        box.current?.focus({ preventScroll: true });
      }
    },
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      props.onPointerDown?.(event);
      pressedWith.current = event.pointerType;
    },
    /**
     * Pressing anything but the box (a row, the search icon, padding) would
     * move the focus into the submenu, away from where the keys go. A link
     * row pressed with the mouse's left button is the exception: the browser
     * starts a drag of it (onto the bookmarks bar, into another tab) only
     * from a press that moved the focus to it, so the focus goes back once
     * the press is over, on its release or the drag's end.
     */
    onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => {
      props.onMouseDown?.(event);
      if (event.defaultPrevented) return;
      const target = event.target as Element;
      if (target === box.current) return;
      const row = target.closest('[role="option"]');
      const drag =
        row?.matches("a[href]") &&
        event.button === 0 &&
        pressedWith.current === "mouse";
      if (!drag) {
        event.preventDefault();
        return;
      }
      const held = document.activeElement;
      pressing.current = true;
      pressOver.current?.abort();
      const over = new AbortController();
      pressOver.current = over;
      const back = () => {
        over.abort();
        pressing.current = false;
        const active = document.activeElement;
        if (
          held instanceof HTMLElement &&
          active instanceof Element &&
          active.matches('[role="option"]') &&
          list?.contains(active)
        ) {
          held.focus({ preventScroll: true });
        }
      };
      const options = { capture: true, signal: over.signal };
      window.addEventListener("mouseup", back, options);
      window.addEventListener("dragend", back, options);
    },
    onEscapeKeyDown: (event: KeyboardEvent) => {
      props.onEscapeKeyDown?.(event);
      if (event.defaultPrevented) return;
      // Radix's submenu would close the whole menu, where this one closes
      // alone, as the menu pattern has it.
      event.preventDefault();
      if (isComposing(event)) return;
      const from = triggerOf(list?.parentElement);
      sub?.setOpen(false);
      from?.focus({ preventScroll: true });
    },
    children: (
      <>
        <FilterBox
          ref={box}
          aria-label={inputLabel}
          expanded
          aria-controls={listId}
          aria-activedescendant={highlight.id ?? undefined}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            const text = event.target.value;
            const content = list?.parentElement;
            if (lock === null && text !== "" && content) {
              const { width, height } = content.getBoundingClientRect();
              setLock({ width, height });
            }
            setHighlight((now) => ({ id: now.id, by: "hit" }));
            onQueryChange(text);
          }}
          onKeyDown={onBoxKeyDown}
        />
        <div
          ref={setList}
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy}
          className="min-h-0 flex-1 overflow-y-auto p-1"
        >
          <FilterContext.Provider
            value={{
              highlighted: highlight.id,
              highlight: (id, by) => setHighlight({ id, by }),
            }}
          >
            {props.children}
          </FilterContext.Provider>
          {none && (
            <div
              role="presentation"
              className="px-2 py-4 text-center text-muted-foreground text-ui"
            >
              {empty(query)}
            </div>
          )}
        </div>
      </>
    ),
  };
}

/**
 * Given `query` and `onQueryChange`, the submenu filters: a filter box over
 * its rows, which the caller filters and passes as children. They are
 * `DropdownMenuItem`, `DropdownMenuCheckboxItem` and
 * `DropdownMenuRadioItem`, with groups, labels and separators between them,
 * but no `DropdownMenuSub` of their own.
 *
 * The focus stays in the box once it has it, so a letter always filters and
 * never jumps to a row: ↑↓, Home and End walk a highlight the box's
 * `aria-activedescendant` follows, Enter clicks the highlighted row, and the
 * arrow back from the start of the box, or Escape, closes this submenu
 * alone. The box takes the focus from a key that enters the submenu or types
 * while it is open, from a mouse entering it, or from a mouse resting on its
 * trigger a moment. Without a fine pointer only a key or a tap on the box
 * gives it the focus, so no on-screen keyboard rises unasked. Each opening
 * starts unfiltered, calling `onQueryChange("")`.
 */
function DropdownMenuSubContent({
  className,
  // MenuSubContent hardwires `side` after spreading these through, but both
  // land on the popper underneath. No onCloseAutoFocus override to match
  // DropdownMenuContent's: it hardwires that one to preventDefault(), so the
  // scrolling focus restore never happens here.
  sticky = "always",
  collisionPadding = 8,
  query,
  onQueryChange,
  placeholder,
  inputLabel,
  empty,
  ...props
}: SubContentProps & DropdownMenuSubFilterProps) {
  const filter = useSubFilter(
    query === undefined || onQueryChange === undefined
      ? null
      : { query, onQueryChange, placeholder, inputLabel, empty },
    props,
  );
  // A filtering submenu is named after its trigger, as its list is.
  const { role: _role, "aria-labelledby": _labelledBy, ...unnamed } = props;
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
        // Filtering, the box stays put over the list, which scrolls.
        filter &&
          "flex max-h-[min(24rem,calc(100dvh-1rem))] flex-col overflow-hidden p-0",
        className,
      )}
      {...(filter ? unnamed : props)}
      {...filter}
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
