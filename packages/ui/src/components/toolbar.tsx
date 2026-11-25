"use client";

import { ChevronDownIcon } from "lucide-react";
import {
  ToggleGroup as ToggleGroupPrimitive,
  Toolbar as ToolbarPrimitive,
} from "radix-ui";
import * as React from "react";

import { cn } from "../lib/utils.ts";
import { Button } from "./button.tsx";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu.tsx";
import {
  Pane,
  type PaneEdge,
  type PaneFrame,
  type PaneResponsive,
} from "./pane.tsx";
import { Separator } from "./separator.tsx";
import {
  CommandTooltip,
  contentOf,
  hasLabel,
  hasMore,
  hasWords,
  mayCollapse,
  Roving,
  ToolbarLabel,
  useLabelHost,
} from "./toolbar/command.tsx";
import { FLAT, iconSize, TOGGLE, textSize } from "./toolbar/look.ts";
import {
  OverflowFace,
  OverflowLabel,
  OverflowLabelsContext,
  OverflowMenu,
  OverflowName,
  OverflowTrigger,
  OverflowValue,
  overflowClass,
  ToolbarOverflow,
} from "./toolbar/overflow.tsx";
import { ToolbarSearch } from "./toolbar/search.tsx";
import {
  dev,
  LabelHostContext,
  OUT_OF_FLOW,
  slotProps,
  type ToolbarCloseOverflowOptions,
  ToolbarContext,
  type ToolbarContextValue,
  type ToolbarInternal,
  ToolbarInternalContext,
  ToolbarItemContext,
  type ToolbarItemContextValue,
  type ToolbarPriority,
  ToolbarStore,
  UnitLabelsContext,
  useComposedRef,
  useToolbar,
  useToolbarItem,
  useToolbarUnit,
} from "./toolbar/store.ts";
import { TooltipProvider } from "./tooltip.tsx";

const noSubscribe = () => () => {};

/**
 * A row of commands that fits the width it is given: what does not fit goes
 * into a ⋯ menu, and comes back as the room does. Before anything moves,
 * a spacer gives up its room and a search narrows; on a fine pointer the
 * words of commands with an icon hide, their tooltips taking them over;
 * a segmented control becomes a dropdown of its value, and an empty search
 * its icon. Then the parts go into the menu, the lowest `priority` first,
 * those set away from their defaults last, and the cluster before the last
 * `ToolbarSpacer` before the one after it.
 *
 * How many parts fit at a width follows the sizes the style and the pointer
 * draw them at; the caller sets their order, their groups and their
 * priorities, never a breakpoint. Its height does not follow: it is as tall
 * as its tallest part in any of its forms. One Tab stop holds the bar, and
 * the arrow keys move between its commands; a search's field is a Tab stop
 * of its own.
 */
function Toolbar({
  edge,
  frame,
  fit = false,
  size = "default",
  labelCollapse = "auto",
  overflowLabel = "More actions",
  overflowActiveLabel = defaultActiveLabel,
  overflowAlign = "end",
  loop = true,
  dir,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "dir"> & {
  /** The side that meets the pane beside it, where the default style rules it off. */
  edge?: PaneResponsive<PaneEdge>;
  /** Set in the flow of another pane, framed on its own. */
  frame?: PaneFrame;
  /** As wide as its parts, up to the width it is given, rather than the whole width. */
  fit?: boolean;
  /** The size of the controls in it that are given none. */
  size?: "sm" | "default";
  /** `never` keeps every command's words, moving commands into the menu instead. */
  labelCollapse?: "auto" | "never";
  /** The ⋯ button's name. */
  overflowLabel?: string;
  /** Its name while parts in the menu are set away from their defaults. */
  overflowActiveLabel?: (count: number) => string;
  /** Which side of the ⋯ its menu lines up with. */
  overflowAlign?: "start" | "end";
  /** The arrow keys wrap from the last command to the first. */
  loop?: boolean;
  dir?: "ltr" | "rtl";
}) {
  const [store] = React.useState(() => new ToolbarStore());
  const result = React.useSyncExternalStore(
    store.subscribe,
    store.getResult,
    store.getResult,
  );
  const coarse = React.useSyncExternalStore(
    store.subscribe,
    () => store.coarse,
    () => false,
  );
  const open = React.useSyncExternalStore(
    store.subscribe,
    () => store.overflowOpen,
    () => false,
  );
  const [hydrated, setHydrated] = React.useState(false);

  React.useLayoutEffect(() => {
    setHydrated(true);
    return store.connect();
  }, [store]);
  React.useLayoutEffect(() => {
    store.solve();
    if (!store.rescueFocus) return;
    store.rescueFocus = false;
    store.triggerRef.current?.focus({ preventScroll: true });
  });
  React.useEffect(() => {
    if (!result.scrollable || !dev()) return;
    console.warn(
      "Toolbar: what is pinned to it does not fit even alone, so it scrolls. Give a pinned part a form in the ⋯ menu, or a lower priority.",
    );
  }, [result.scrollable]);

  const internal = React.useMemo<ToolbarInternal>(
    () => ({ store, size, labelCollapse }),
    [store, size, labelCollapse],
  );
  const anyLabelsHidden = Object.values(result.views).includes("label");
  const hasOverflow = result.overflow.length > 0;
  const value = React.useMemo<ToolbarContextValue>(
    () => ({
      inToolbar: true,
      size,
      coarsePointer: coarse,
      anyLabelsHidden,
      searchTakeover: result.takeover,
      hasOverflow,
      overflowTriggerRef: store.triggerRef,
      closeOverflow: store.closeOverflow,
    }),
    [size, coarse, anyLabelsHidden, result.takeover, hasOverflow, store],
  );
  const labels = React.useMemo(
    () => ({ overflowLabel, overflowActiveLabel }),
    [overflowLabel, overflowActiveLabel],
  );

  const rowRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      store.row = el;
      if (!el) return;
      store.observe(el);
      return () => {
        store.unobserve(el);
        store.row = null;
      };
    },
    [store],
  );
  const paneRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      store.pane = el;
    },
    [store],
  );
  const shellRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      store.shell = el;
      if (!el) return;
      store.observe(el);
      return () => {
        store.unobserve(el);
        store.shell = null;
      };
    },
    [store],
  );

  const bar = (
    <Pane purpose="toolbar" edge={edge} frame={frame} asChild>
      <ToolbarPrimitive.Root
        ref={paneRef}
        loop={loop}
        dir={dir}
        data-slot="toolbar"
        data-size={size}
        data-search-takeover={result.takeover ? "" : undefined}
        className={cn(
          "flex min-w-0 items-center gap-0.5 p-1",
          // The parts held in place for the ⋯ menu are out of sight and out
          // of the flow, and may still reach past the bar.
          result.scrollable ? "overflow-x-auto" : "overflow-x-clip",
          fit && "w-fit max-w-full",
          className,
        )}
        {...props}
      >
        <div
          ref={rowRef}
          data-slot="toolbar-row"
          className={cn(
            // Nothing transitions in the frame a new layout is drawn in
            // (`ToolbarStore`'s `markRelayout`).
            "relative flex min-w-0 flex-1 items-center gap-[inherit] data-relayout:**:transition-none",
            // Before the bar is measured (a prerendered page), what does not
            // fit wraps onto a line of its own, cut off, rather than show
            // half a button.
            hydrated
              ? "flex-nowrap"
              : "max-h-control flex-wrap overflow-hidden touch:max-h-field-touch",
            result.takeover &&
              "[&>*:not([data-slot=toolbar-search],[data-toolbar-internal])]:hidden",
          )}
        >
          {children}
          {result.trigger?.at === "end" && <OverflowTrigger />}
          <Rulers />
        </div>
      </ToolbarPrimitive.Root>
    </Pane>
  );

  return (
    <ToolbarInternalContext.Provider value={internal}>
      <ToolbarContext.Provider value={value}>
        <OverflowLabelsContext.Provider value={labels}>
          <TooltipProvider>
            <DropdownMenu
              open={open}
              onOpenChange={(next) => store.setOverflowOpen(next)}
            >
              {fit ? (
                <div
                  ref={shellRef}
                  data-slot="toolbar-shell"
                  className="flex w-full min-w-0"
                >
                  {bar}
                </div>
              ) : (
                bar
              )}
              <OverflowMenu align={overflowAlign} />
            </DropdownMenu>
          </TooltipProvider>
        </OverflowLabelsContext.Provider>
      </ToolbarContext.Provider>
    </ToolbarInternalContext.Provider>
  );
}

function defaultActiveLabel(count: number) {
  return `More actions (${count} active)`;
}

type RulerField = "iconRuler" | "textRuler" | "countRuler" | "wideCountRuler";

/**
 * An icon button and a text button of the bar's size, drawn as its commands
 * are, and the ⋯ with a count of one digit and of `9+`, all out of sight:
 * what hiding a label gives back, and the ⋯'s widths, read from the style
 * and pointer in force.
 */
function Rulers() {
  const internal = React.useContext(ToolbarInternalContext);
  const store = internal?.store;
  const refs = React.useMemo(() => {
    const ruler = (field: RulerField) => (el: HTMLButtonElement | null) => {
      if (!store) return;
      store[field] = el;
      if (!el) return;
      store.observe(el);
      return () => store.unobserve(el);
    };
    return {
      icon: ruler("iconRuler"),
      text: ruler("textRuler"),
      count: ruler("countRuler"),
      wideCount: ruler("wideCountRuler"),
    };
  }, [store]);
  if (!internal) return null;
  const counted = (ref: (el: HTMLButtonElement | null) => void, n: number) => (
    <Button
      ref={ref}
      variant="ghost"
      size={iconSize(internal.size)}
      tabIndex={-1}
      className={overflowClass(n)}
    >
      <OverflowFace count={n} />
    </Button>
  );
  return (
    <div
      data-toolbar-internal=""
      aria-hidden
      inert
      className={cn(OUT_OF_FLOW, "flex")}
    >
      <Button
        ref={refs.icon}
        variant="ghost"
        size={iconSize(internal.size)}
        tabIndex={-1}
        className={FLAT}
      >
        <svg aria-hidden />
      </Button>
      <Button
        ref={refs.text}
        variant="ghost"
        size={textSize(internal.size)}
        tabIndex={-1}
        className={FLAT}
      >
        <svg aria-hidden />
        <span />
      </Button>
      {counted(refs.count, 8)}
      {counted(refs.wideCount, 10)}
    </div>
  );
}

type Selection = "none" | "single" | "multiple";

interface GroupState {
  selection: Selection;
  values: readonly string[];
  toggle: (value: string) => void;
}

const GroupContext = React.createContext<GroupState | null>(null);

type GroupValueProps =
  | {
      selection?: "none";
      value?: never;
      defaultValue?: never;
      onValueChange?: never;
    }
  | {
      selection: "single";
      value?: string;
      defaultValue?: string;
      onValueChange?: (value: string) => void;
    }
  | {
      selection: "multiple";
      value?: string[];
      defaultValue?: string[];
      onValueChange?: (value: string[]) => void;
    };

type ToolbarGroupProps = Omit<
  React.ComponentProps<"div">,
  "defaultValue" | "onChange"
> & {
  /** The group's name, for a screen reader, and its heading in the ⋯ menu when only one may be chosen. */
  label?: string;
  priority?: ToolbarPriority;
  /**
   * Set away from its default: it leaves the bar last within its
   * `priority`, and is counted on the ⋯ while it is in there. Defaults to
   * having a selection, under `selection="multiple"`.
   */
  active?: boolean;
} & GroupValueProps;

/**
 * Commands that stay together: on the bar or in the ⋯ menu, never split.
 * With a `selection` its `ToolbarButton`s, each given a `value`, are
 * toggles: `single`, one of them on at a time (an alignment), as menu radio
 * items once in the menu; `multiple`, each on or off (bold, italic), as
 * check items.
 */
function ToolbarGroup(props: ToolbarGroupProps) {
  const item = React.useContext(ToolbarItemContext);
  if (item?.surface === "overflow") return <GroupMenu {...props} />;
  return <GroupBar {...props} />;
}

const groupActive = (props: ToolbarGroupProps, values: readonly string[]) =>
  props.active ?? (props.selection === "multiple" && values.length > 0);

function useGroupState(props: ToolbarGroupProps): GroupState & {
  set: (next: string | string[]) => void;
} {
  const selection = props.selection ?? "none";
  const [own, setOwn] = React.useState<string | string[] | undefined>(
    props.defaultValue,
  );
  const current = props.value !== undefined ? props.value : own;
  const values = Array.isArray(current)
    ? current
    : current === undefined || current === ""
      ? []
      : [current];
  const controlled = props.value !== undefined;
  const onValueChange = props.onValueChange as
    | ((value: string | string[]) => void)
    | undefined;
  const set = (next: string | string[]) => {
    if (!controlled) setOwn(next);
    onValueChange?.(next);
  };
  return {
    selection,
    values,
    set,
    toggle: (value: string) => {
      if (selection === "multiple") {
        set(
          values.includes(value)
            ? values.filter((each) => each !== value)
            : [...values, value],
        );
      } else set(value);
    },
  };
}

function GroupBar(props: ToolbarGroupProps) {
  const {
    label,
    priority,
    active: _active,
    selection = "none",
    value: _value,
    defaultValue: _defaultValue,
    onValueChange: _onValueChange,
    className,
    children,
    ref,
    // The toolbar's own direction reaches the toggles through Radix.
    dir: _dir,
    ...rest
  } = props;
  const state = useGroupState(props);
  const { set, values } = state;
  const unit = useToolbarUnit({
    meta: {
      priority,
      active: groupActive(props, values),
      overflowable: true,
      group: true,
      // Controlled by this one, so the bar and the menu show one state.
      renderOverflow: () => (
        <ToolbarGroup
          {...({
            ...props,
            value: selection === "multiple" ? values : (values[0] ?? ""),
            onValueChange: set,
          } as unknown as ToolbarGroupProps)}
        />
      ),
    },
  });
  const overflowed = unit.view === "overflow";
  const composed = useComposedRef(ref, unit.ref);
  const group: GroupState = { selection, values, toggle: state.toggle };
  const shared = {
    ...rest,
    ...slotProps(overflowed),
    ref: composed,
    "aria-label": rest["aria-label"] ?? label,
    "data-slot": "toolbar-group",
    className: cn(
      "flex shrink-0 items-center gap-[inherit]",
      overflowed && OUT_OF_FLOW,
      className,
    ),
  };
  let body: React.ReactNode;
  if (selection === "none") {
    body = (
      // biome-ignore lint/a11y/useSemanticElements: a fieldset would hold its commands at their min-content width and disable them as a form's
      <div role="group" {...shared}>
        {children}
      </div>
    );
  } else {
    const Root = unit.internal
      ? ToolbarPrimitive.ToggleGroup
      : ToggleGroupPrimitive.Root;
    body =
      selection === "single" ? (
        <Root
          type="single"
          value={values[0] ?? ""}
          // A single choice is never none: pressing the chosen one keeps it.
          onValueChange={(next: string) => {
            if (next) set(next);
          }}
          {...shared}
        >
          {children}
        </Root>
      ) : (
        <Root
          type="multiple"
          value={[...values]}
          onValueChange={(next: string[]) => set(next)}
          {...shared}
        >
          {children}
        </Root>
      );
  }
  return (
    <GroupContext.Provider value={group}>
      <ToolbarItemContext.Provider value={unit.item}>
        <UnitLabelsContext.Provider value={unit.labels}>
          {body}
        </UnitLabelsContext.Provider>
      </ToolbarItemContext.Provider>
    </GroupContext.Provider>
  );
}

function GroupMenu(props: ToolbarGroupProps) {
  const { label, selection = "none", children } = props;
  const state = useGroupState(props);
  const group = { selection, values: state.values, toggle: state.toggle };
  if (selection === "single") {
    return (
      <GroupContext.Provider value={group}>
        {label && (
          <OverflowLabel active={groupActive(props, state.values)}>
            {label}
          </OverflowLabel>
        )}
        <DropdownMenuRadioGroup
          aria-label={label}
          value={state.values[0] ?? ""}
          onValueChange={(next) => state.set(next)}
        >
          {children}
        </DropdownMenuRadioGroup>
      </GroupContext.Provider>
    );
  }
  return (
    <GroupContext.Provider value={group}>
      <DropdownMenuGroup aria-label={label}>{children}</DropdownMenuGroup>
    </GroupContext.Provider>
  );
}

type ButtonVariant = React.ComponentProps<typeof Button>["variant"];

type ToolbarButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "variant"
> & {
  /** `ghost`, flat on the bar, unless given. */
  variant?: ButtonVariant;
  /** Its value as a toggle of a `ToolbarGroup` with a `selection`. */
  value?: string;
  /** Its key, as printed on the keyboard, in its tooltip and beside it in the ⋯ menu. */
  shortcut?: string;
  /** What its tooltip says, when not its words or its `aria-label`. */
  tooltip?: React.ReactNode;
  /**
   * Whether its `ToolbarLabel` may hide to fit. A primary or destructive
   * command keeps its words unless told otherwise.
   */
  labelCollapse?: "auto" | "never";
  priority?: ToolbarPriority;
  /**
   * Set away from its default: it leaves the bar last within its
   * `priority`, and is counted on the ⋯ while it is in there. Defaults to
   * `aria-pressed`.
   */
  active?: boolean;
};

/**
 * A command in a toolbar: a ghost button, an icon alone (named with
 * `aria-label`, which its tooltip shows) or an icon with its words in a
 * `ToolbarLabel`, which hide when the bar is short of room. In the ⋯ menu
 * it is a menu item, a check item while it has `aria-pressed`, and a link
 * still with `asChild`; its `onClick` then gets the menu item's event.
 *
 * A style redraws it in place, never re-laid out: raymond keeps it flat until
 * the pointer raises it by one pixel, and sinks it while held or open, as
 * Windows 2000's toolbars do. A command that stays on (a star) sets
 * `aria-pressed`, which raymond draws latched, sunk over a dithered face.
 *
 * One that opens a menu or a popover of its own cannot be followed into the
 * ⋯ menu: it stays on the bar. `ToolbarMenu` is a menu that can.
 */
function ToolbarButton(props: ToolbarButtonProps) {
  const internal = React.useContext(ToolbarInternalContext);
  const item = React.useContext(ToolbarItemContext);
  if (item?.surface === "overflow") return <ButtonMenuItem {...props} />;
  if (!internal) return <LoneToolbarButton {...props} />;
  return <BarToolbarButton {...props} />;
}

const toIcon = (size: ToolbarButtonProps["size"]) => {
  switch (size) {
    case "xs":
      return "icon-xs" as const;
    case "sm":
      return "icon-sm" as const;
    case "lg":
      return "icon-lg" as const;
    case "default":
      return "icon" as const;
    default:
      return size;
  }
};

const pressed = (value: React.AriaAttributes["aria-pressed"]) =>
  value === true || value === "true";

/** Outside a toolbar, as it always was: an icon size unless given one. */
function LoneToolbarButton({
  variant = "ghost",
  size = "icon",
  value,
  shortcut,
  tooltip,
  labelCollapse: _labelCollapse,
  priority: _priority,
  active: _active,
  className,
  ...props
}: ToolbarButtonProps) {
  const group = React.useContext(GroupContext);
  const button = (
    <Button
      variant={variant}
      size={size}
      data-slot="toolbar-button"
      className={cn(
        variant === "ghost" && FLAT,
        group && group.selection !== "none" && value !== undefined && TOGGLE,
        className,
      )}
      value={group ? undefined : value}
      {...props}
    />
  );
  const toggle =
    group && group.selection !== "none" && value !== undefined ? (
      <ToggleGroupPrimitive.Item value={value} asChild>
        {button}
      </ToggleGroupPrimitive.Item>
    ) : (
      button
    );
  if (tooltip === undefined && shortcut === undefined) return toggle;
  return (
    <CommandTooltip
      enabled
      text={tooltip ?? props["aria-label"]}
      shortcut={shortcut}
    >
      {toggle}
    </CommandTooltip>
  );
}

function BarToolbarButton(props: ToolbarButtonProps) {
  const {
    variant = "ghost",
    size,
    value,
    shortcut,
    tooltip,
    labelCollapse,
    priority,
    active,
    asChild,
    disabled,
    className,
    children,
    ref,
    ...rest
  } = props;
  const internal = React.useContext(ToolbarInternalContext) as ToolbarInternal;
  const group = React.useContext(GroupContext);
  const content = contentOf(children, asChild);
  const labelled = hasLabel(content);
  const words = hasWords(content);
  const popup = rest["aria-haspopup"];
  // A trigger of the caller's own menu or popover: drawn in the ⋯ menu, its
  // surface would have nothing on the bar to open from.
  const opensSurface =
    popup !== undefined && popup !== false && popup !== "false";
  const collapsible =
    labelled &&
    hasMore(content) &&
    mayCollapse(labelCollapse, internal.labelCollapse, variant);
  const unit = useToolbarUnit({
    meta: {
      priority: opensSurface ? "pin" : priority,
      active: active ?? pressed(rest["aria-pressed"]),
      overflowable: !opensSurface,
      renderOverflow: () => <ToolbarButton {...props} ref={undefined} />,
    },
  });
  React.useEffect(() => {
    if (!opensSurface || !unit.registered || !dev()) return;
    console.warn(
      "ToolbarButton: a button that opens its own menu or popover stays on the bar, as `ToolbarMenu`, `FilterMenu` or a `ToolbarItem` with `overflow` would not.",
    );
  }, [opensSurface, unit.registered]);
  const overflowed = unit.view === "overflow";
  const { host, text, button } = useLabelHost(
    "swap",
    collapsible,
    unit.item.labelHidden,
  );
  const hidden = host.hidden;
  const resolved =
    size !== undefined
      ? hidden
        ? toIcon(size)
        : size
      : words && !hidden
        ? textSize(internal.size)
        : iconSize(internal.size);
  const toggle =
    group !== null && group.selection !== "none" && value !== undefined;
  const composed = useComposedRef(ref, unit.ref, button);
  const name = rest["aria-label"] ?? (hidden ? text : undefined);
  const element = (
    <CommandTooltip
      enabled={
        tooltip !== undefined || shortcut !== undefined || hidden || !words
      }
      text={tooltip ?? (labelled ? text : rest["aria-label"])}
      shortcut={shortcut}
    >
      <Button
        {...rest}
        {...slotProps(overflowed)}
        ref={composed}
        variant={variant}
        size={resolved}
        asChild={asChild}
        data-slot="toolbar-button"
        aria-label={name}
        className={cn(
          variant === "ghost" && FLAT,
          toggle && TOGGLE,
          overflowed && OUT_OF_FLOW,
          className,
        )}
      >
        {children}
      </Button>
    </CommandTooltip>
  );
  const body = toggle ? (
    <ToolbarPrimitive.ToggleItem value={value} disabled={disabled} asChild>
      {element}
    </ToolbarPrimitive.ToggleItem>
  ) : (
    <Roving link={asChild} {...(asChild ? {} : { disabled })}>
      {element}
    </Roving>
  );
  const hosted = (
    <ToolbarItemContext.Provider value={unit.item}>
      <LabelHostContext.Provider value={host}>{body}</LabelHostContext.Provider>
    </ToolbarItemContext.Provider>
  );
  return unit.registered ? (
    <UnitLabelsContext.Provider value={unit.labels}>
      {hosted}
    </UnitLabelsContext.Provider>
  ) : (
    hosted
  );
}

function ButtonMenuItem({
  variant,
  value,
  shortcut,
  tooltip,
  asChild,
  disabled,
  children,
  onClick,
  "aria-label": ariaLabel,
  "aria-pressed": ariaPressed,
}: ToolbarButtonProps) {
  const group = React.useContext(GroupContext);
  const content = contentOf(children, asChild);
  const inner = (
    <>
      {content}
      {!hasWords(content) && (
        <span>{typeof tooltip === "string" ? tooltip : ariaLabel}</span>
      )}
      {shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
    </>
  );
  // The menu item's event, not the button's: the button is out of sight.
  const select = onClick as unknown as React.MouseEventHandler<HTMLDivElement>;
  if (group && group.selection !== "none" && value !== undefined) {
    if (group.selection === "single") {
      return (
        <DropdownMenuRadioItem value={value} disabled={disabled}>
          {inner}
        </DropdownMenuRadioItem>
      );
    }
    return (
      <DropdownMenuCheckboxItem
        checked={group.values.includes(value)}
        onCheckedChange={() => group.toggle(value)}
        disabled={disabled}
      >
        {inner}
      </DropdownMenuCheckboxItem>
    );
  }
  if (ariaPressed !== undefined) {
    return (
      <DropdownMenuCheckboxItem
        checked={pressed(ariaPressed)}
        disabled={disabled}
        onClick={select}
      >
        {inner}
      </DropdownMenuCheckboxItem>
    );
  }
  const menuVariant = variant === "destructive" ? "destructive" : "default";
  if (asChild && React.isValidElement(children)) {
    return (
      <DropdownMenuItem asChild variant={menuVariant} disabled={disabled}>
        {React.cloneElement(children, undefined, inner)}
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem
      variant={menuVariant}
      disabled={disabled}
      onClick={select}
    >
      {inner}
    </DropdownMenuItem>
  );
}

/**
 * A menu of the toolbar's own: a button naming it, with an icon, its words
 * (which hide to fit, or never show with `iconOnly`) and its `value`, the
 * choice it holds. In the ⋯ menu it is a submenu.
 */
function ToolbarMenu(props: ToolbarMenuProps) {
  const item = React.useContext(ToolbarItemContext);
  if (item?.surface === "overflow") return <MenuSub {...props} />;
  return <BarToolbarMenu {...props} />;
}

interface ToolbarMenuProps {
  icon?: React.ReactNode;
  /** Its name: its words on the bar, its tooltip, its row in the ⋯ menu. */
  label: string;
  /** Show the icon alone, named and tooltipped by `label`. */
  iconOnly?: boolean;
  /** The choice it holds, shown after its words (`Open`, `Alice`). */
  value?: React.ReactNode;
  /**
   * Set away from its default: it leaves the bar last within its
   * `priority`, and is counted on the ⋯ while it is in there.
   */
  active?: boolean;
  variant?: "ghost" | "outline";
  labelCollapse?: "auto" | "never";
  priority?: ToolbarPriority;
  align?: "start" | "end";
  contentClassName?: string;
  disabled?: boolean;
  /** `DropdownMenu` items. */
  children: React.ReactNode;
}

function BarToolbarMenu(props: ToolbarMenuProps) {
  const {
    icon,
    label,
    iconOnly = false,
    value,
    active,
    variant = "ghost",
    labelCollapse,
    priority,
    align = "start",
    contentClassName,
    disabled,
    children,
  } = props;
  const internal = React.useContext(ToolbarInternalContext);
  const size = internal?.size ?? "default";
  const collapsible =
    !iconOnly &&
    icon !== undefined &&
    mayCollapse(labelCollapse, internal?.labelCollapse ?? "auto", variant);
  const unit = useToolbarUnit({
    meta: {
      priority,
      active,
      overflowable: true,
      renderOverflow: () => <ToolbarMenu {...props} />,
    },
  });
  const overflowed = unit.view === "overflow";
  const { host, button } = useLabelHost(
    "stay",
    collapsible,
    unit.item.labelHidden,
  );
  const hidden = host.hidden;
  const id = React.useId();
  const composed = useComposedRef(unit.ref, button);
  const named = value !== undefined && !iconOnly;
  const trigger = (
    <Button
      {...slotProps(overflowed)}
      ref={composed}
      variant={variant}
      size={iconOnly ? iconSize(size) : textSize(size)}
      disabled={disabled}
      data-slot="toolbar-menu"
      aria-label={iconOnly || (hidden && !named) ? label : undefined}
      // The words hidden to fit still name it, with the value after them.
      aria-labelledby={named ? `${id}-label ${id}-value` : undefined}
      className={cn(variant === "ghost" && FLAT, overflowed && OUT_OF_FLOW)}
    >
      {icon}
      {!iconOnly && (
        <ToolbarLabel
          className={value !== undefined ? "text-muted-foreground" : undefined}
        >
          <span id={`${id}-label`}>{label}</span>
        </ToolbarLabel>
      )}
      {named && <span id={`${id}-value`}>{value}</span>}
      {!iconOnly && <ChevronDownIcon className="text-muted-foreground" />}
    </Button>
  );
  const menu = (
    <DropdownMenu>
      <Roving disabled={disabled}>
        <DropdownMenuTrigger asChild>
          <CommandTooltip enabled={iconOnly || hidden} text={label}>
            {trigger}
          </CommandTooltip>
        </DropdownMenuTrigger>
      </Roving>
      <DropdownMenuContent align={align} className={contentClassName}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const body = (
    <ToolbarItemContext.Provider value={unit.item}>
      <LabelHostContext.Provider value={host}>{menu}</LabelHostContext.Provider>
    </ToolbarItemContext.Provider>
  );
  return unit.registered ? (
    <UnitLabelsContext.Provider value={unit.labels}>
      {body}
    </UnitLabelsContext.Provider>
  ) : (
    body
  );
}

function MenuSub({
  icon,
  label,
  value,
  active,
  disabled,
  contentClassName,
  children,
}: ToolbarMenuProps) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled}>
        {icon}
        <OverflowName marked={active === true && value === undefined}>
          {label}
        </OverflowName>
        {value !== undefined && (
          <OverflowValue active={active}>{value}</OverflowValue>
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className={contentClassName}>
        {children}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/**
 * The room between a toolbar's clusters, pushing what follows to its end.
 * It is the first to give up its room; with one, the cluster before the last
 * spacer goes into the ⋯ menu before the one after it, and the ⋯ stands at
 * the end of the first cluster that overflows.
 */
function ToolbarSpacer({
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children">) {
  const unit = useToolbarUnit({
    kind: "spacer",
    meta: { overflowable: false },
  });
  const store = unit.internal?.store;
  const before = React.useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => {
      const trigger = store?.result.trigger;
      return trigger?.at === "before" ? trigger.id : null;
    },
    () => null,
  );
  return (
    <>
      {before === unit.id && <OverflowTrigger />}
      <div
        ref={unit.ref}
        aria-hidden
        data-slot="toolbar-spacer"
        className={cn("min-w-0 flex-1", className)}
        {...props}
      />
    </>
  );
}

/**
 * A rule between groups of commands, etched under raymond as every
 * Separator is. In a toolbar one that would part nothing (at an end, beside
 * a spacer or the ⋯, after another) is not drawn, and the ⋯ menu parts what
 * it held at the same place.
 */
function ToolbarSeparator(props: React.ComponentProps<typeof Separator>) {
  const item = React.useContext(ToolbarItemContext);
  if (item?.surface === "overflow") return <DropdownMenuSeparator />;
  return <BarSeparator {...props} />;
}

function BarSeparator({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof Separator>) {
  const unit = useToolbarUnit({
    kind: "separator",
    meta: { overflowable: false },
  });
  const composed = useComposedRef(ref, unit.ref);
  const separator = (
    <Separator
      orientation="vertical"
      data-slot="toolbar-separator"
      // A Separator stretches to its row; given a height of its own, as this
      // one is, a stretched item stands at the row's top instead.
      className={cn(
        "mx-1 h-5 data-vertical:self-center",
        unit.view === "hidden" && OUT_OF_FLOW,
        className,
      )}
      {...props}
      ref={composed}
    />
  );
  if (!unit.internal) return separator;
  return (
    <ToolbarPrimitive.Separator asChild>{separator}</ToolbarPrimitive.Separator>
  );
}

/**
 * Anything else on a toolbar, counted and moved as one part: give it
 * `overflow`, what it is in the ⋯ menu, or it stays on the bar. A `flex`
 * one takes the room left, down to `minWidth`. Its `overflow` renders in
 * the menu, beyond any context its own children provide: what it needs it
 * takes from the closure it is written in.
 */
function ToolbarItem({
  priority,
  flex = false,
  minWidth,
  active,
  overflow,
  className,
  style,
  children,
  ref,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  priority?: ToolbarPriority;
  flex?: boolean;
  minWidth?: number;
  /**
   * Set away from its default: it leaves the bar last within its
   * `priority`, and is counted on the ⋯ while it is in there.
   */
  active?: boolean;
  overflow?:
    | React.ReactNode
    | ((context: {
        close: (options?: ToolbarCloseOverflowOptions) => void;
      }) => React.ReactNode);
  children?: React.ReactNode;
}) {
  const item = React.useContext(ToolbarItemContext);
  if (item?.surface === "overflow") {
    return (
      <>
        {typeof overflow === "function"
          ? overflow({ close: item.closeOverflow })
          : overflow}
      </>
    );
  }
  return (
    <BarItem
      {...{ priority, flex, minWidth, active, overflow, className, style, ref }}
      {...props}
    >
      {children}
    </BarItem>
  );
}

function BarItem({
  priority,
  flex,
  minWidth,
  active,
  overflow,
  className,
  style,
  children,
  ref,
  ...props
}: React.ComponentProps<typeof ToolbarItem>) {
  const internal = React.useContext(ToolbarInternalContext);
  const close = internal?.store.closeOverflow;
  const unit = useToolbarUnit({
    meta: {
      priority: overflow === undefined ? "pin" : priority,
      active,
      overflowable: overflow !== undefined,
      renderOverflow: () =>
        typeof overflow === "function"
          ? overflow({ close: close ?? (() => {}) })
          : overflow,
    },
    measure: flex ? () => ({ width: minWidth ?? 0 }) : undefined,
  });
  const overflowed = unit.view === "overflow";
  const composed = useComposedRef(ref, unit.ref);
  return (
    <ToolbarItemContext.Provider value={unit.item}>
      <div
        {...props}
        {...slotProps(overflowed)}
        ref={composed}
        data-slot="toolbar-item"
        className={cn(
          "flex shrink-0 items-center",
          flex && "min-w-0 flex-1",
          overflowed && OUT_OF_FLOW,
          className,
        )}
        style={flex && minWidth !== undefined ? { minWidth, ...style } : style}
      >
        {children}
      </div>
    </ToolbarItemContext.Provider>
  );
}

export {
  Toolbar,
  ToolbarButton,
  type ToolbarCloseOverflowOptions,
  type ToolbarContextValue,
  ToolbarGroup,
  ToolbarItem,
  type ToolbarItemContextValue,
  ToolbarLabel,
  ToolbarMenu,
  ToolbarOverflow,
  type ToolbarPriority,
  ToolbarSearch,
  ToolbarSeparator,
  ToolbarSpacer,
  useToolbar,
  useToolbarItem,
};
