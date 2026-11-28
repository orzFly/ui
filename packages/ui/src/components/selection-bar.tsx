import { XIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils.ts";
import { Checkbox, SelectSlot } from "./checkbox.tsx";
import { Roving } from "./toolbar/command.tsx";
import { ToolbarInternalContext } from "./toolbar/store.ts";
import {
  Toolbar,
  ToolbarButton,
  ToolbarItem,
  ToolbarSpacer,
} from "./toolbar.tsx";

/**
 * The toolbar over a list or tree whose rows can be selected: a `Toolbar`
 * that starts with a select-all checkbox. While anything is selected it holds
 * the count, the app's actions on the selection (`children`) and, at its end,
 * a button that clears it; while nothing is, `idle`, the list's own toolbar.
 * Both are a toolbar's parts themselves (`ToolbarButton`, `ToolbarMenu`,
 * `FilterMenu`, `ToolbarSearch`, `ToolbarSpacer`, a `ToolbarItem`…), never a
 * `Toolbar` of their own: they give way and go into the ⋯ menu as on any
 * toolbar, while the checkbox, the count and the clear button stay. An app
 * with no toolbar of its own mounts the bar only while `count` is above zero.
 *
 * The bar is one Tab stop, the arrow keys going from the checkbox to the
 * clear button. It is as tall in both states as long as nothing in it is
 * taller than the checkbox's box, as no control of the library's is. When it
 * turns from one state to the other with the focus in the half that goes (an
 * action that used the selection up, the clear button, Escape inside it), the
 * checkbox takes the focus. A partly checked box selects the rest, and a
 * fully checked one clears. The count is a live region, read out as it
 * changes. Given an `icon`, the list's own, the box stands in for it as a
 * row's does: the icon shows while nothing is selected, and the box while
 * the pointer is on the bar.
 */
function SelectionBar({
  count,
  total,
  onSelectAll,
  onClear,
  idle,
  icon,
  selectAllLabel = "Select all",
  clearLabel = "Clear selection",
  countLabel = (count) => `${count} selected`,
  className,
  children,
  onKeyDown,
  onPointerEnter,
  onPointerLeave,
  ...props
}: Omit<React.ComponentProps<typeof Toolbar>, "fit"> & {
  /** How many rows are selected. */
  count: number;
  /** How many rows select-all selects: those on screen, or every one the app can reach. */
  total: number;
  onSelectAll: () => void;
  onClear: () => void;
  /** The list's toolbar parts while nothing is selected, after the checkbox. */
  idle?: React.ReactNode;
  /** The list's icon, which the checkbox stands in for until it is wanted. */
  icon?: React.ReactNode;
  selectAllLabel?: string;
  clearLabel?: string;
  countLabel?: (count: number) => string;
}) {
  const checkbox = React.useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = React.useState(false);
  const selecting = count > 0;
  const all = total > 0 && count >= total;
  const box = {
    ref: checkbox,
    checked: all ? true : selecting ? ("indeterminate" as const) : false,
    disabled: total === 0,
    onCheckedChange: () => (all ? onClear() : onSelectAll()),
    "aria-label": selectAllLabel,
  };
  const clear = () => {
    onClear();
    checkbox.current?.focus();
  };
  return (
    <Toolbar
      data-slot="selection-bar"
      data-selecting={selecting || undefined}
      className={cn(
        // Its row is the box's height before it is measured too (a
        // prerendered page), as it is once the bar holds it.
        "shrink-0 px-1.5 py-1.5 text-ui [--toolbar-row-cap:2rem] touch:[--toolbar-row-cap:max(2rem,var(--spacing-field-touch))]",
        className,
      )}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.key !== "Escape" || !selecting) {
          return;
        }
        event.preventDefault();
        clear();
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (event.pointerType !== "touch") setHovered(true);
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        setHovered(false);
      }}
      {...props}
    >
      {/* As wide as the box's hit area on touch, so it ends where the
          first command's room begins. */}
      <span className="flex size-8 shrink-0 items-center justify-center touch:w-touch">
        <Roving disabled={total === 0}>
          {icon === undefined ? (
            <Checkbox {...box} />
          ) : (
            <SelectSlot icon={icon} revealed={hovered} {...box} />
          )}
        </Roving>
      </span>
      {/* Mounted while idle too, empty: a live region is only read out once it exists. */}
      <span
        role="status"
        className={
          selecting ? "shrink-0 px-1 font-medium tabular-nums" : "sr-only"
        }
      >
        {selecting ? countLabel(count) : ""}
      </span>
      {/* Keyed, so a part of one half is never reused, its element and focus
          with it, as the part of the other half at the same place. */}
      {selecting ? (
        <React.Fragment key="selecting">
          {children}
          <ToolbarSpacer />
          <ToolbarItem>
            <ToolbarButton aria-label={clearLabel} onClick={clear}>
              <XIcon />
            </ToolbarButton>
          </ToolbarItem>
        </React.Fragment>
      ) : (
        <React.Fragment key="idle">{idle}</React.Fragment>
      )}
      <FocusHandoff selecting={selecting} checkbox={checkbox} />
    </Toolbar>
  );
}

const noSubscribe = () => () => {};

/**
 * Hands the focus to the checkbox as the bar turns from one state to the
 * other, when it was in the half that went: on a part of it, in a menu or
 * surface one of them opened, or in the ⋯ menu.
 */
function FocusHandoff({
  selecting,
  checkbox,
}: {
  selecting: boolean;
  checkbox: React.RefObject<HTMLButtonElement | null>;
}) {
  const store = React.useContext(ToolbarInternalContext)?.store;
  const open = React.useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.overflowOpen ?? false,
    () => false,
  );
  const was = React.useRef(selecting);
  const pending = React.useRef(false);
  React.useLayoutEffect(() => {
    if (was.current === selecting) return;
    was.current = selecting;
    const last = store?.lastFocused;
    if (!store || !last || last === checkbox.current) return;
    // Put elsewhere since the bar last had it (a part that held it went
    // with no state change, and the focus moved on): it stays there.
    const active = document.activeElement;
    if (active !== null && active !== document.body && active !== last) {
      return;
    }
    pending.current = true;
    if (store.overflowOpen) store.closeOverflow();
  }, [selecting, store, checkbox]);
  // After every commit: the one that turned the bar, or the one that closed
  // the ⋯ menu for it.
  React.useEffect(() => {
    if (!pending.current || open) return;
    // Not before the commit that closes the ⋯ menu has let go of the focus:
    // until its passive effects run, Radix holds the focus in the menu and
    // would take it straight back.
    pending.current = false;
    checkbox.current?.focus();
  });
  return null;
}

export { SelectionBar };
