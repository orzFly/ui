"use client";

import type { VariantProps } from "class-variance-authority";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils.ts";
import { Button, type buttonVariants } from "./button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu.tsx";
import {
  CommandTooltip,
  contentOf,
  hasLabel,
  hasMore,
  hasWords,
  mayCollapse,
  Roving,
  useLabelHost,
} from "./toolbar/command.tsx";
import { FLAT } from "./toolbar/look.ts";
import {
  LabelHostContext,
  OUT_OF_FLOW,
  slotProps,
  ToolbarInternalContext,
  ToolbarItemContext,
  type ToolbarPriority,
  UnitLabelsContext,
  useComposedRef,
  useToolbarUnit,
} from "./toolbar/store.ts";

type Variant = VariantProps<typeof buttonVariants>["variant"];
type Size = "xs" | "sm" | "default" | "lg";

const ICON: Record<Size, "icon-xs" | "icon-sm" | "icon" | "icon-lg"> = {
  xs: "icon-xs",
  sm: "icon-sm",
  default: "icon",
  lg: "icon-lg",
};

interface SplitState {
  variant: Variant;
  size: Size;
  disabled: boolean;
  labelCollapse: "auto" | "never" | undefined;
  /** Drawn in the ⋯ menu, and how. */
  menu: "sub" | "group" | null;
}

const SplitContext = React.createContext<SplitState | null>(null);

function useSplit(part: string): SplitState {
  const state = React.useContext(SplitContext);
  if (!state) throw new Error(`${part} must be used within SplitButton`);
  return state;
}

/**
 * A command with its variants beside it: the button does the usual thing,
 * the arrow beside it opens a menu of the others (Merge, then Squash and
 * merge). Two buttons, one beside the other, never one inside the other.
 *
 * Outside a toolbar it is an `outline` button with its arrow joined on;
 * in a `Toolbar` it is flat as the bar's commands are, takes the bar's
 * size, and goes into the ⋯ menu whole: its command as an item with its
 * variants in a submenu (`overflow="sub"`) or after it (`"group"`).
 */
function SplitButton({
  variant,
  size,
  priority,
  labelCollapse,
  overflow = "sub",
  disabled = false,
  className,
  children,
  ref,
  ...props
}: React.ComponentProps<"div"> & {
  /** `outline` outside a toolbar, flat inside one, unless given. */
  variant?: Variant;
  /** The bar's size in a toolbar, `default` outside one, unless given. */
  size?: Size;
  /** In a `Toolbar`, how soon it gives up room. */
  priority?: ToolbarPriority;
  /** In a `Toolbar`, whether its command's `ToolbarLabel` may hide to fit. */
  labelCollapse?: "auto" | "never";
  /** In the ⋯ menu: its variants in a submenu, or listed after its command. */
  overflow?: "sub" | "group";
  disabled?: boolean;
}) {
  const internal = React.useContext(ToolbarInternalContext);
  const item = React.useContext(ToolbarItemContext);
  const inMenu = item?.surface === "overflow";
  const resolvedVariant = variant ?? (internal ? "ghost" : "outline");
  const resolvedSize = size ?? internal?.size ?? "default";
  const allProps = {
    variant,
    size,
    priority,
    labelCollapse,
    overflow,
    disabled,
    className,
    children,
    ...props,
  };
  const unit = useToolbarUnit({
    enabled: !inMenu,
    meta: {
      priority,
      overflowable: true,
      group: true,
      renderOverflow: () => <SplitButton {...allProps} />,
    },
  });
  const composed = useComposedRef(ref, unit.ref);
  const state = React.useMemo<SplitState>(
    () => ({
      variant: resolvedVariant,
      size: resolvedSize,
      disabled,
      labelCollapse,
      menu: inMenu ? overflow : null,
    }),
    [resolvedVariant, resolvedSize, disabled, labelCollapse, inMenu, overflow],
  );
  if (inMenu) {
    return (
      <SplitContext.Provider value={state}>
        {overflow === "group" ? (
          <DropdownMenuGroup>{children}</DropdownMenuGroup>
        ) : (
          children
        )}
      </SplitContext.Provider>
    );
  }
  const overflowed = unit.view === "overflow";
  const body = (
    <SplitContext.Provider value={state}>
      <ToolbarItemContext.Provider value={unit.item}>
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would part its halves as a form's group, and disable them with it */}
        <div
          role="group"
          {...props}
          {...slotProps(overflowed)}
          ref={composed}
          data-slot="button-group"
          data-split-button=""
          data-variant={resolvedVariant}
          className={cn(
            "group/split relative inline-flex shrink-0 items-stretch",
            overflowed && OUT_OF_FLOW,
            className,
          )}
        >
          {children}
        </div>
      </ToolbarItemContext.Provider>
    </SplitContext.Provider>
  );
  return unit.registered ? (
    <UnitLabelsContext.Provider value={unit.labels}>
      {body}
    </UnitLabelsContext.Provider>
  ) : (
    body
  );
}

// In a toolbar, under raymond, pointing at either half raises both, the
// lit edge of the arrow's half against the dark edge of the command's
// etching the line between them; the half held or open sinks alone.
const IN_BAR =
  "raymond:group-hover/split:shadow-[inset_1px_1px_var(--3d-highlight),inset_-1px_-1px_var(--3d-shadow)] raymond:group-hover/split:active:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)] raymond:group-hover/split:aria-expanded:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)]";

/**
 * The command half. With `asChild` it is the caller's link. In a toolbar
 * its `ToolbarLabel` hides to fit as a `ToolbarButton`'s does.
 */
function SplitButtonAction({
  shortcut,
  tooltip,
  asChild,
  disabled,
  className,
  children,
  ref,
  onClick,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "variant" | "size"> & {
  /** Its key, as printed on the keyboard, in its tooltip and beside it in the ⋯ menu. */
  shortcut?: string;
  tooltip?: React.ReactNode;
}) {
  const split = useSplit("SplitButtonAction");
  const internal = React.useContext(ToolbarInternalContext);
  const item = React.useContext(ToolbarItemContext);
  const content = contentOf(children, asChild);
  const labelled = hasLabel(content);
  const words = hasWords(content);
  const collapsible =
    internal !== null &&
    labelled &&
    hasMore(content) &&
    mayCollapse(split.labelCollapse, internal.labelCollapse, split.variant);
  const { host, text, button } = useLabelHost(
    "swap",
    collapsible,
    item?.labelHidden ?? false,
  );
  const composed = useComposedRef(ref, button);
  if (split.menu) {
    const inner = (
      <>
        {content}
        {!words && <span>{props["aria-label"]}</span>}
        {shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
      </>
    );
    if (asChild && React.isValidElement(children)) {
      return (
        <DropdownMenuItem asChild disabled={disabled || split.disabled}>
          {React.cloneElement(children, undefined, inner)}
        </DropdownMenuItem>
      );
    }
    return (
      <DropdownMenuItem
        disabled={disabled || split.disabled}
        onClick={onClick as unknown as React.MouseEventHandler<HTMLDivElement>}
      >
        {inner}
      </DropdownMenuItem>
    );
  }
  const hidden = host.hidden;
  const size = hidden || !words ? ICON[split.size] : split.size;
  return (
    <LabelHostContext.Provider value={host}>
      <Roving
        link={asChild}
        {...(asChild ? {} : { disabled: disabled || split.disabled })}
      >
        <CommandTooltip
          enabled={
            tooltip !== undefined ||
            shortcut !== undefined ||
            hidden ||
            (internal !== null && !words)
          }
          text={tooltip ?? (labelled ? text : props["aria-label"])}
          shortcut={shortcut}
        >
          <Button
            {...props}
            ref={composed}
            variant={split.variant}
            size={size}
            asChild={asChild}
            onClick={onClick}
            data-slot="split-button-action"
            aria-label={props["aria-label"] ?? (hidden ? text : undefined)}
            className={cn(
              "rounded-e-none focus-visible:z-10",
              internal && split.variant === "ghost" && [FLAT, IN_BAR],
              className,
            )}
          >
            {children}
          </Button>
        </CommandTooltip>
      </Roving>
    </LabelHostContext.Provider>
  );
}

/**
 * The arrow half and its menu of the command's variants. `triggerLabel`
 * names the arrow, and heads the submenu in the ⋯ menu.
 */
function SplitButtonMenu({
  triggerLabel,
  align = "end",
  disabled,
  contentClassName,
  children,
}: {
  triggerLabel: string;
  align?: React.ComponentProps<typeof DropdownMenuContent>["align"];
  /** Disables the arrow alone. */
  disabled?: boolean;
  contentClassName?: string;
  /** `DropdownMenu` items. */
  children: React.ReactNode;
}) {
  const split = useSplit("SplitButtonMenu");
  const internal = React.useContext(ToolbarInternalContext);
  if (split.menu === "group") return children;
  if (split.menu === "sub") {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={disabled || split.disabled}>
          {triggerLabel}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className={contentClassName}>
          {children}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }
  const off = disabled || split.disabled;
  const outline = split.variant === "outline";
  return (
    <DropdownMenu>
      <Roving disabled={off}>
        <DropdownMenuTrigger asChild>
          <CommandTooltip enabled={internal !== null} text={triggerLabel}>
            <Button
              variant={split.variant}
              size={ICON[split.size]}
              disabled={off}
              aria-label={triggerLabel}
              data-slot="split-button-trigger"
              className={cn(
                "rounded-s-none focus-visible:z-10",
                // An outline's borders overlap into one; any other
                // variant is parted by a line in its own text colour.
                outline
                  ? "-ms-px raymond:ms-0"
                  : "before:pointer-events-none before:absolute before:inset-y-1.5 before:start-0 before:w-px before:bg-current before:opacity-20 raymond:before:hidden",
                internal && split.variant === "ghost" && [FLAT, IN_BAR],
              )}
            >
              <ChevronDownIcon />
            </Button>
          </CommandTooltip>
        </DropdownMenuTrigger>
      </Roving>
      <DropdownMenuContent align={align} className={contentClassName}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export {
  SplitButton,
  SplitButtonAction,
  SplitButtonMenu,
  type ToolbarPriority,
};
