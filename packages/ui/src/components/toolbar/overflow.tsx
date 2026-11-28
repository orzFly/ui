import { EllipsisIcon } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils.ts";
import { Badge } from "../badge.tsx";
import { Button } from "../button.tsx";
import { DropdownMenuLabel, DropdownMenuTrigger } from "../dropdown-menu.tsx";
import { OverflowMenu as SharedOverflowMenu } from "../overflow/menu.tsx";
import { CommandTooltip, RovingItem } from "./command.tsx";
import { FLAT, iconSize } from "./look.ts";
import {
  ToolbarInternalContext,
  ToolbarItemContext,
  type ToolbarItemContextValue,
  useToolbarUnit,
} from "./store.ts";

export interface OverflowLabels {
  overflowLabel: string;
  overflowActiveLabel: (count: number) => string;
}

export const OverflowLabelsContext = React.createContext<OverflowLabels>({
  overflowLabel: "More actions",
  overflowActiveLabel: (count) => `More actions (${count} active)`,
});

const noSubscribe = () => () => {};

/**
 * The ⋯ button's class. Beside a count it is as wide as it holds, and, wider
 * than the touch spacing already, keeps no touch room beside it, as an icon
 * button in a `ButtonGroup` keeps none.
 */
export function overflowClass(count: number, className?: string) {
  return cn(FLAT, count > 0 && "mx-0 w-auto gap-[3px] px-1", className);
}

/** What the ⋯ button holds: its ellipsis, then how many parts in it are set away from their defaults. */
export function OverflowFace({ count }: { count: number }) {
  return (
    <>
      <EllipsisIcon />
      {count > 0 && (
        // Inside the Badge's own border 14px are left of the 16, less than its
        // line: `leading-none` keeps the digits in the middle.
        <Badge
          variant="marker"
          aria-hidden
          data-slot="toolbar-overflow-count"
          className="h-4 min-w-4 px-1 py-0 leading-none tabular-nums raymond:h-3.5"
        >
          {count >= 10 ? "9+" : count}
        </Badge>
      )}
    </>
  );
}

/** Marks a row of the ⋯ menu whose part is set away from its default. */
function ActiveMark() {
  return (
    // Under raymond a square, as the period drew every mark.
    <span
      aria-hidden
      data-slot="toolbar-active-mark"
      className="size-1.5 shrink-0 rounded-full bg-current raymond:rounded-none"
    />
  );
}

/**
 * A part's value after its name in the ⋯ menu: quiet, or, while the part is
 * set away from its default, in the row's own colour after an `ActiveMark`.
 */
export function OverflowValue({
  active,
  children,
}: {
  active: boolean | undefined;
  children: React.ReactNode;
}) {
  if (!active) return <span className="text-muted-foreground">{children}</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <ActiveMark />
      {children}
    </span>
  );
}

/** A part's name in the ⋯ menu, taking the row's room; marked after it when the row shows no value. */
export function OverflowName({
  marked,
  children,
}: {
  marked: boolean;
  children: React.ReactNode;
}) {
  if (!marked) return <span className="flex-1">{children}</span>;
  return (
    <span className="flex flex-1 items-center gap-1.5">
      {children}
      <ActiveMark />
    </span>
  );
}

/** A part's heading over its items in the ⋯ menu, marked after its name while the part is set away from its default. */
export function OverflowLabel({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  if (!active) return <DropdownMenuLabel>{children}</DropdownMenuLabel>;
  return (
    <DropdownMenuLabel className="flex items-center gap-1.5">
      {children}
      <ActiveMark />
    </DropdownMenuLabel>
  );
}

/** The ⋯ button: a toolbar's icon button, counting what it holds set away from its defaults. */
export function OverflowTrigger({ className }: { className?: string }) {
  const internal = React.useContext(ToolbarInternalContext);
  const labels = React.useContext(OverflowLabelsContext);
  const store = internal?.store;
  const count = React.useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.result.activeCount ?? 0,
    () => 0,
  );
  if (!internal || !store) return null;
  const label =
    count > 0 ? labels.overflowActiveLabel(count) : labels.overflowLabel;
  return (
    <RovingItem>
      <DropdownMenuTrigger asChild>
        <CommandTooltip enabled text={label}>
          <Button
            ref={store.triggerRef}
            variant="ghost"
            size={iconSize(internal.size)}
            data-slot="toolbar-overflow-trigger"
            aria-label={label}
            className={overflowClass(count, className)}
          >
            <OverflowFace count={count} />
          </Button>
        </CommandTooltip>
      </DropdownMenuTrigger>
    </RovingItem>
  );
}

/**
 * Where the ⋯ stands. Without it, a toolbar puts the ⋯ at the end of the
 * first cluster that overflows. With `children`, menu items of its own, the
 * ⋯ is always shown and holds them below whatever the bar moved into it.
 */
export function ToolbarOverflow({
  className,
  contentClassName,
  children,
}: {
  className?: string;
  /** The menu's class: its width, say. */
  contentClassName?: string;
  /** `DropdownMenu` items kept in the menu whether or not anything overflows. */
  children?: React.ReactNode;
}) {
  const permanent =
    children !== undefined && children !== null && children !== false;
  const unit = useToolbarUnit({
    kind: "overflow",
    meta: {
      overflowable: false,
      permanent,
      renderOverflow: permanent ? () => children : undefined,
      contentClassName,
    },
  });
  const store = unit.internal?.store;
  const placed = React.useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.result.trigger?.at ?? null,
    () => null,
  );
  if (!unit.internal) return null;
  const shown = permanent || placed === "explicit";
  return (
    <span ref={unit.ref} data-slot="toolbar-overflow" className="contents">
      {shown && <OverflowTrigger className={className} />}
    </span>
  );
}

/** The ⋯ menu: the parts the bar moved into it, in order, then the `ToolbarOverflow`'s own items. */
export function OverflowMenu({ align }: { align: "start" | "end" }) {
  const internal = React.useContext(ToolbarInternalContext);
  const store = internal?.store;
  React.useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.menuVersion ?? 0,
    () => 0,
  );
  const item = React.useMemo<ToolbarItemContextValue | null>(
    () =>
      store
        ? {
            surface: "overflow",
            overflowed: true,
            labelHidden: false,
            collapsedToDropdown: false,
            collapsedToIcon: false,
            closeOverflow: store.closeOverflow,
          }
        : null,
    [store],
  );
  if (!store || !item) return null;
  const own = store.permanentRecord();
  const permanent = own?.meta.permanent === true;
  return (
    <SharedOverflowMenu
      store={store}
      align={align}
      data-slot="toolbar-overflow-content"
      className={cn("w-auto min-w-44", own?.meta.contentClassName)}
      // The bar's own handlers do not hear the menu, which is not inside it.
      onFocus={store.focusIn}
      onBlur={store.focusOut}
      surface={(children) => (
        <ToolbarItemContext.Provider value={item}>
          {children}
        </ToolbarItemContext.Provider>
      )}
      after={permanent ? own?.meta.renderOverflow?.() : undefined}
    />
  );
}
