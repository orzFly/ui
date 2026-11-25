import { EllipsisIcon } from "lucide-react";
import { Toolbar as ToolbarPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "../../lib/utils.ts";
import { Button } from "../button.tsx";
import {
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu.tsx";
import { CommandTooltip } from "./command.tsx";
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

/** The ⋯ button: a toolbar's icon button, marked while what it holds is set away from its defaults. */
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
    <ToolbarPrimitive.Button asChild>
      <DropdownMenuTrigger asChild>
        <CommandTooltip enabled text={label}>
          <Button
            ref={store.triggerRef}
            variant="ghost"
            size={iconSize(internal.size)}
            data-slot="toolbar-overflow-trigger"
            aria-label={label}
            className={cn(FLAT, className)}
          >
            <EllipsisIcon />
            {count > 0 && (
              // Under raymond a square, as the period drew every mark.
              <span
                aria-hidden
                data-slot="toolbar-overflow-badge"
                className="absolute end-1 top-1 size-1.5 rounded-full bg-primary raymond:rounded-none"
              />
            )}
          </Button>
        </CommandTooltip>
      </DropdownMenuTrigger>
    </ToolbarPrimitive.Button>
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
  const records = store.overflowRecords();
  const breaks = new Set(store.result.breaks);
  const own = store.permanentRecord();
  const permanent = own?.meta.permanent === true;
  return (
    <DropdownMenuContent
      align={align}
      data-slot="toolbar-overflow-content"
      className={cn("w-auto min-w-44", own?.meta.contentClassName)}
      onCloseAutoFocus={(event) => {
        // An item that opened its own surface has the focus, or is about to.
        if (!store.keepFocusOnClose) return;
        store.keepFocusOnClose = false;
        event.preventDefault();
      }}
    >
      <ToolbarItemContext.Provider value={item}>
        {records.map((record) => (
          <React.Fragment key={record.id}>
            {breaks.has(record.id) && <DropdownMenuSeparator />}
            {record.meta.renderOverflow?.()}
          </React.Fragment>
        ))}
        {records.length > 0 && permanent && <DropdownMenuSeparator />}
        {permanent && own?.meta.renderOverflow?.()}
      </ToolbarItemContext.Provider>
    </DropdownMenuContent>
  );
}
