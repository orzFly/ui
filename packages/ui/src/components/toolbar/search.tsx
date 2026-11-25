import { ArrowLeftIcon, SearchIcon, XIcon } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils.ts";
import { Button } from "../button.tsx";
import { Input } from "../input.tsx";
import { CommandTooltip, Roving } from "./command.tsx";
import { FLAT, iconSize } from "./look.ts";
import {
  OUT_OF_FLOW,
  outerWidth,
  ToolbarItemContext,
  type ToolbarPriority,
  useToolbarUnit,
} from "./store.ts";

const noSubscribe = () => () => {};

const FIELD = 'input, textarea, [contenteditable="true"]';

export interface ToolbarSearchProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Enter in the field. */
  onSubmit?: (value: string) => void;
  placeholder?: string;
  /** The field's name, and its icon's. */
  label?: string;
  /** The narrowest the field gets before it gives way to the icon. */
  minWidth?: number;
  /** The widest the field gets. */
  maxWidth?: number;
  /** `never` keeps the field however narrow the bar gets. */
  collapse?: "icon" | "never";
  /** A button in the field that empties it. */
  clearable?: boolean;
  priority?: ToolbarPriority;
  className?: string;
  /**
   * A field of the caller's own (a `QueryBox`) in place of the plain one.
   * Pass `value` too, so the search knows whether it is empty.
   */
  children?: React.ReactNode;
}

/**
 * A search field in a toolbar. Short of room it narrows to `minWidth`, then,
 * while empty, gives way to its icon; pressing the icon opens the field
 * again at `minWidth`, moving other parts into the ⋯ menu, and only when
 * nothing else could make room does it take the whole bar, with a button
 * back. A field with a query never turns into its icon. The field is one
 * element throughout, so the caret and an IME composition survive every
 * change, and it is a Tab stop of its own: the arrow keys move its caret.
 */
export function ToolbarSearch({
  value,
  defaultValue,
  onValueChange,
  onSubmit,
  placeholder,
  label = "Search",
  minWidth = 160,
  maxWidth = 280,
  collapse = "icon",
  clearable = true,
  priority,
  className,
  children,
}: ToolbarSearchProps) {
  const [own, setOwn] = React.useState(defaultValue ?? "");
  const text = value ?? own;
  const empty = text === "";
  const [pinned, setPinned] = React.useState(false);
  const probe = React.useRef<HTMLElement | null>(null);
  const field = React.useRef<HTMLDivElement>(null);
  const icon = React.useRef<HTMLButtonElement>(null);
  const focusField = React.useRef(false);
  const focusIcon = React.useRef(false);
  /** The clear button had the focus, and goes when the field empties. */
  const clearFocused = React.useRef(false);
  const unit = useToolbarUnit({
    meta: {
      priority: priority ?? "pin",
      overflowable: false,
      pinned,
      active: !empty,
    },
    measure: () => ({
      width: minWidth,
      iconWidth:
        collapse === "icon" && empty && !pinned && probe.current
          ? outerWidth(probe.current)
          : undefined,
    }),
  });
  const store = unit.internal?.store;
  const size = unit.internal?.size ?? "default";
  const takeover = React.useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.result.takeover ?? false,
    () => false,
  );
  const holding = takeover && pinned;
  const iconView = unit.view === "icon" && !pinned;

  const set = (next: string) => {
    if (value === undefined) setOwn(next);
    onValueChange?.(next);
  };

  React.useLayoutEffect(() => {
    if (empty && clearFocused.current) {
      clearFocused.current = false;
      if (document.activeElement === document.body) focusField.current = true;
    }
    if (focusField.current && !iconView) {
      focusField.current = false;
      field.current
        ?.querySelector<HTMLElement>(FIELD)
        ?.focus({ preventScroll: true });
    }
    if (focusIcon.current && iconView) {
      focusIcon.current = false;
      icon.current?.focus({ preventScroll: true });
    }
  });

  const open = () => {
    focusField.current = true;
    setPinned(true);
  };
  // An empty field goes back to its icon, which takes the focus; one with a
  // query stays, and keeps it.
  const close = () => {
    if (empty) focusIcon.current = true;
    else focusField.current = true;
    setPinned(false);
    store?.releaseTakeover();
  };

  const probeRef = React.useCallback(
    (el: HTMLElement | null) => {
      probe.current = el;
      if (!el || !store) return;
      store.observe(el);
      return () => store.unobserve(el);
    },
    [store],
  );

  const input = children ?? (
    <>
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => set(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === "Enter") onSubmit?.(text);
          if (event.key === "Escape" && (pinned || holding)) {
            event.preventDefault();
            if (empty || holding) close();
          }
        }}
        // The browser's own clear button would sit beside this one.
        className={cn(
          "ps-8 [&::-webkit-search-cancel-button]:appearance-none",
          clearable && !empty && "pe-8",
        )}
      />
      {clearable && !empty && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Clear"
          className="absolute end-1 top-1/2 -translate-y-1/2"
          onFocus={() => {
            clearFocused.current = true;
          }}
          onBlur={() => {
            clearFocused.current = false;
          }}
          onClick={() => {
            set("");
            field.current
              ?.querySelector<HTMLElement>(FIELD)
              ?.focus({ preventScroll: true });
          }}
        >
          <XIcon />
        </Button>
      )}
    </>
  );

  return (
    <ToolbarItemContext.Provider value={unit.item}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: it hears the focus leave the field and its buttons, and acts on nothing itself */}
      <div
        ref={unit.ref}
        data-slot="toolbar-search"
        data-collapsed={iconView ? "" : undefined}
        className={cn("relative flex min-w-0 items-center gap-1", className)}
        style={
          iconView || !unit.registered
            ? undefined
            : holding
              ? { flex: "1 1 auto" }
              : { flex: `0 1 ${maxWidth}px`, minWidth, maxWidth }
        }
        onBlur={(event) => {
          const to = event.relatedTarget;
          if (to instanceof Node && event.currentTarget.contains(to)) return;
          // Left empty, it gives its room back; with a query it keeps it.
          if (pinned && empty) {
            setPinned(false);
            store?.releaseTakeover();
          }
        }}
      >
        {holding && (
          <Roving>
            <CommandTooltip enabled text="Back">
              <Button
                variant="ghost"
                size={iconSize(size)}
                aria-label="Back"
                className={FLAT}
                onClick={close}
              >
                <ArrowLeftIcon />
              </Button>
            </CommandTooltip>
          </Roving>
        )}
        {iconView && (
          <Roving>
            <CommandTooltip enabled text={label}>
              <Button
                ref={icon}
                variant="ghost"
                size={iconSize(size)}
                aria-label={label}
                data-slot="toolbar-search-icon"
                className={FLAT}
                onClick={open}
              >
                <SearchIcon />
              </Button>
            </CommandTooltip>
          </Roving>
        )}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: it keeps the field's caret keys from the toolbar, and acts on nothing itself */}
        <div
          ref={field}
          data-slot="toolbar-search-field"
          inert={iconView || undefined}
          className={cn(
            "relative flex min-w-0 flex-1 items-center",
            iconView && OUT_OF_FLOW,
          )}
          // The caret's keys, not the toolbar's.
          onKeyDown={(event) => {
            if (
              event.key === "ArrowLeft" ||
              event.key === "ArrowRight" ||
              event.key === "Home" ||
              event.key === "End"
            ) {
              event.stopPropagation();
            }
          }}
        >
          {input}
        </div>
        {unit.registered && collapse === "icon" && (
          <span aria-hidden inert className={OUT_OF_FLOW}>
            <Button
              ref={probeRef}
              variant="ghost"
              size={iconSize(size)}
              tabIndex={-1}
              className={FLAT}
            >
              <SearchIcon />
            </Button>
          </span>
        )}
      </div>
    </ToolbarItemContext.Provider>
  );
}
