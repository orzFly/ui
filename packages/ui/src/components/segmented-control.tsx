import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils.ts";
import { Button } from "./button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./dropdown-menu.tsx";
import { CommandTooltip, RovingItem } from "./toolbar/command.tsx";
import { FLAT, textSize } from "./toolbar/look.ts";
import { OverflowLabel } from "./toolbar/overflow.tsx";
import {
  OUT_OF_FLOW,
  outerHeight,
  outerWidth,
  slotProps,
  ToolbarItemContext,
  type ToolbarPriority,
  useComposedRef,
  useToolbarUnit,
} from "./toolbar/store.ts";

interface Segment {
  label: React.ReactNode;
  disabled: boolean;
  el: HTMLElement | null;
  /** Its words as last drawn, which the dropdown's button names it by. */
  text: string;
}

const SegmentedControlContext = React.createContext<{
  value: string | undefined;
  onPress: (value: string) => void;
  /** On a toolbar's bar: each segment is one of its arrow-key stops. */
  roving: boolean;
  /** Writes a segment in, or its latest label and state. */
  register: (value: string, segment: Segment) => void;
  unregister: (value: string) => void;
}>({
  value: undefined,
  onPress: () => {},
  roving: false,
  register: () => {},
  unregister: () => {},
});

/**
 * One of two or three modes of a tool, side by side, the pressed one marked: a hex editor's
 * typing mode, a light or dark switch. It acts the moment one is pressed. Name it with
 * `aria-label`; `value` with `onValueChange` controls it, `defaultValue` leaves it to itself.
 *
 * In a `Toolbar` short of room it becomes a dropdown of its value (`collapse="dropdown"`),
 * then a group of radio items in the ⋯ menu; `collapse="overflow"` skips the dropdown, and
 * `"never"` keeps it whole on the bar.
 */
function SegmentedControl({
  value: controlled,
  defaultValue,
  onValueChange,
  collapse = "dropdown",
  priority,
  toolbarActive = false,
  className,
  children,
  ref,
  ...props
}: Omit<React.ComponentProps<"fieldset">, "defaultValue"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** In a `Toolbar`, how it gives up room. Outside one it is ignored. */
  collapse?: "dropdown" | "overflow" | "never";
  /** In a `Toolbar`, how soon it gives up room. */
  priority?: ToolbarPriority;
  /**
   * In a `Toolbar`, its value is set away from its default: it leaves the
   * bar last within its `priority`, and is counted on the ⋯ while it is in
   * there. Outside one it is ignored.
   */
  toolbarActive?: boolean;
}) {
  const [own, setOwn] = React.useState(defaultValue);
  const value = controlled ?? own;
  const onPress = React.useCallback(
    (next: string) => {
      setOwn(next);
      onValueChange?.(next);
    },
    [onValueChange],
  );
  const segments = React.useRef(new Map<string, Segment>());
  const [, setVersion] = React.useState(0);
  const register = React.useCallback((key: string, segment: Segment) => {
    const was = segments.current.get(key);
    segments.current.set(key, segment);
    // Re-rendered only when what the dropdown shows changes: the label is
    // new on every render, its text is not.
    if (was?.disabled !== segment.disabled || was?.text !== segment.text) {
      setVersion((v) => v + 1);
    }
  }, []);
  const unregister = React.useCallback((key: string) => {
    if (segments.current.delete(key)) setVersion((v) => v + 1);
  }, []);

  const item = React.useContext(ToolbarItemContext);
  const name = props["aria-label"];
  const choices = () =>
    [...segments.current.entries()].map(([key, segment]) => (
      <DropdownMenuRadioItem key={key} value={key} disabled={segment.disabled}>
        {segment.label}
      </DropdownMenuRadioItem>
    ));
  const probe = React.useRef<HTMLButtonElement>(null);
  const items = React.useRef<HTMLDivElement>(null);
  const unit = useToolbarUnit({
    enabled: item?.surface !== "overflow",
    meta: {
      priority: collapse === "never" ? "pin" : priority,
      active: toolbarActive,
      overflowable: collapse !== "never",
      group: true,
      renderOverflow: () => (
        <>
          {name && <OverflowLabel active={toolbarActive}>{name}</OverflowLabel>}
          <DropdownMenuRadioGroup
            aria-label={name}
            value={value ?? ""}
            onValueChange={onPress}
          >
            {choices()}
          </DropdownMenuRadioGroup>
        </>
      ),
    },
    measure: (view, el) => ({
      ...(view === "dropdown" && items.current
        ? {
            width: outerWidth(items.current),
            // Its segments', held out of sight behind the dropdown.
            height: Math.max(outerHeight(el), outerHeight(items.current)),
          }
        : {}),
      dropdownWidth:
        collapse === "dropdown" && probe.current
          ? outerWidth(probe.current)
          : undefined,
    }),
  });
  const composed = useComposedRef(ref, unit.ref);
  const inToolbar = unit.registered;
  const dropdown = inToolbar && unit.view === "dropdown";
  const overflowed = unit.view === "overflow";
  const context = React.useMemo(
    () => ({
      value,
      onPress,
      roving: inToolbar && !dropdown,
      register,
      unregister,
    }),
    [value, onPress, inToolbar, dropdown, register, unregister],
  );
  const current = value === undefined ? undefined : segments.current.get(value);
  const size = unit.internal?.size ?? "default";
  const currentText = current?.text ?? "";

  return (
    <SegmentedControlContext.Provider value={context}>
      <ToolbarItemContext.Provider value={unit.item}>
        <fieldset
          {...props}
          {...slotProps(overflowed)}
          ref={composed}
          data-slot="segmented-control"
          data-collapsed={dropdown ? "" : undefined}
          // Under raymond a run of toolbar buttons only one of which latches,
          // as WordPad's alignment: on the face, with no track of its own.
          className={cn(
            "grid grid-flow-col rounded-[calc(var(--radius-control)*0.8)] bg-muted p-0.5 raymond:bg-transparent",
            // As a dropdown, the button alone, on no track.
            dropdown && "relative bg-transparent p-0",
            overflowed && OUT_OF_FLOW,
            className,
          )}
        >
          {inToolbar ? (
            // Kept as a dropdown too, out of sight: they hold the choices,
            // and their width is the control's in full.
            <div
              ref={items}
              inert={dropdown || undefined}
              data-slot="segmented-control-items"
              className={
                dropdown
                  ? cn(OUT_OF_FLOW, "grid grid-flow-col p-0.5")
                  : "contents"
              }
            >
              {children}
            </div>
          ) : (
            children
          )}
          {dropdown && (
            <DropdownMenu>
              <RovingItem>
                <DropdownMenuTrigger asChild>
                  <CommandTooltip enabled={name !== undefined} text={name}>
                    <Button
                      variant="ghost"
                      size={textSize(size)}
                      aria-label={name ? `${name}: ${currentText}` : undefined}
                      className={FLAT}
                    >
                      {current?.label}
                      <ChevronDownIcon className="text-muted-foreground" />
                    </Button>
                  </CommandTooltip>
                </DropdownMenuTrigger>
              </RovingItem>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup
                  aria-label={name}
                  value={value ?? ""}
                  onValueChange={onPress}
                >
                  {choices()}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {inToolbar && collapse === "dropdown" && (
            <span aria-hidden inert className={OUT_OF_FLOW}>
              <Button
                ref={probe}
                variant="ghost"
                size={textSize(size)}
                tabIndex={-1}
                className={FLAT}
              >
                {current?.label}
                <ChevronDownIcon />
              </Button>
            </span>
          )}
        </fieldset>
      </ToolbarItemContext.Provider>
    </SegmentedControlContext.Provider>
  );
}

/** One mode, pressed while it is the control's value. */
function SegmentedControlItem({
  value,
  className,
  onClick,
  disabled,
  children,
  ref,
  ...props
}: Omit<React.ComponentProps<"button">, "value"> & { value: string }) {
  const context = React.useContext(SegmentedControlContext);
  const own = React.useRef<HTMLButtonElement>(null);
  const composed = useComposedRef(ref, own);
  const { register, unregister } = context;
  React.useLayoutEffect(() => () => unregister(value), [unregister, value]);
  React.useLayoutEffect(() => {
    register(value, {
      label: children,
      disabled: disabled === true,
      el: own.current,
      text: own.current?.textContent ?? "",
    });
  });
  const button = (
    <button
      {...props}
      ref={composed}
      type="button"
      disabled={disabled}
      data-slot="segmented-control-item"
      aria-pressed={context.value === value}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) context.onPress(value);
      }}
      // Under raymond flat until the pointer raises it by a pixel, and the
      // pressed one sunk by a pixel over the face dithered with its
      // highlight, as a latched toolbar button is; all in the window text.
      // On touch at least the touch spacing wide: the segments join, so room
      // beside one would part them, and one holding only an icon would share
      // a tap.
      className={cn(
        "relative inline-flex items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)*0.6)] px-2.5 py-1 text-muted-foreground text-ui-sm outline-none transition-colors enabled:hover:text-foreground focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:pressed-cue touch:hit-area touch:min-w-touch",
        "raymond:text-foreground raymond:transition-none raymond:[--focus-offset:-3px] raymond:enabled:not-aria-pressed:hover:shadow-[inset_1px_1px_var(--3d-highlight),inset_-1px_-1px_var(--3d-shadow)] raymond:aria-pressed:bg-(--3d-highlight) raymond:aria-pressed:bg-[conic-gradient(var(--3d-face)_25%,transparent_0_50%,var(--3d-face)_0_75%,transparent_0)] raymond:aria-pressed:bg-size-[2px_2px] raymond:aria-pressed:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)] raymond:disabled:opacity-100 raymond:disabled:text-(--3d-shadow) raymond:disabled:[text-shadow:1px_1px_var(--3d-highlight)]",
        className,
      )}
    >
      {children}
    </button>
  );
  if (!context.roving) return button;
  return <RovingItem disabled={disabled}>{button}</RovingItem>;
}

export { SegmentedControl, SegmentedControlItem };
