import { XIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils.ts";
import { Checkbox, SelectSlot } from "./checkbox.tsx";
import { Pane } from "./pane.tsx";
import { ToolbarButton } from "./toolbar.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip.tsx";

/**
 * The toolbar over a list or tree whose rows can be selected: a select-all
 * checkbox, then, while anything is selected, the count, the app's actions
 * on the selection (`children`, usually `ToolbarButton`s) and a button that
 * clears it. While nothing is selected it holds `idle`, the app's own
 * toolbar content; an app with no such toolbar mounts the bar only while
 * `count` is above zero.
 *
 * The checkbox stays put in both states, so a clear, by the button or by
 * Escape inside the bar, hands the focus to it rather than dropping it with
 * the actions. A partly checked box selects the rest, and a fully checked one
 * clears. The count is a live region, read out as it changes. Given an `icon`,
 * the list's own, the box stands in for it as a row's does: the icon shows
 * while nothing is selected, and the box while the pointer is on the bar.
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
}: Omit<React.ComponentProps<typeof Pane>, "purpose" | "asChild"> & {
  /** How many rows are selected. */
  count: number;
  /** How many rows select-all selects: those on screen, or every one the app can reach. */
  total: number;
  onSelectAll: () => void;
  onClear: () => void;
  /** What the bar holds while nothing is selected, after the checkbox. */
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
    <Pane
      purpose="toolbar"
      data-slot="selection-bar"
      data-selecting={selecting || undefined}
      className={cn(
        "flex shrink-0 items-center gap-0.5 px-1.5 py-1.5 text-ui",
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
        {icon === undefined ? (
          <Checkbox {...box} />
        ) : (
          <SelectSlot icon={icon} revealed={hovered} {...box} />
        )}
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
      {selecting ? (
        <>
          {children}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToolbarButton
                  aria-label={clearLabel}
                  className="ml-auto shrink-0"
                  onClick={clear}
                >
                  <XIcon />
                </ToolbarButton>
              </TooltipTrigger>
              <TooltipContent>{clearLabel}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </>
      ) : (
        idle
      )}
    </Pane>
  );
}

export { SelectionBar };
