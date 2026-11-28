import * as React from "react";
import {
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "../dropdown-menu.tsx";
import type { OverflowResult, OverflowStore, PartMeta } from "./store.ts";

/**
 * The ⋯ menu: the folded parts' menu forms, in row order, a separator
 * before each the store parts from the one before, then `after`. It must
 * sit inside the `DropdownMenu` whose trigger is the ⋯.
 */
export function OverflowMenu<M extends PartMeta>({
  store,
  align,
  className,
  "data-slot": slot,
  surface,
  after,
  onFocus,
  onBlur,
}: {
  store: OverflowStore<M, OverflowResult>;
  align: "start" | "end";
  className?: string;
  "data-slot": string;
  /** Wraps the folded parts' menu forms and `after` (Toolbar: its item context saying "overflow"). */
  surface?: (children: React.ReactNode) => React.ReactNode;
  /** Items kept after the folded parts, parted from them by a separator. */
  after?: React.ReactNode;
  onFocus?: React.FocusEventHandler<HTMLDivElement>;
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
}) {
  React.useSyncExternalStore(
    store.subscribe,
    () => store.menuVersion,
    () => 0,
  );
  const records = store.overflowRecords();
  const breaks = new Set(store.result.breaks);
  const kept = after !== undefined && after !== null && after !== false;
  const items = (
    <>
      {records.map((record) => (
        <React.Fragment key={record.id}>
          {breaks.has(record.id) && <DropdownMenuSeparator />}
          {record.meta.renderOverflow?.()}
        </React.Fragment>
      ))}
      {records.length > 0 && kept && <DropdownMenuSeparator />}
      {kept && after}
    </>
  );
  return (
    <DropdownMenuContent
      align={align}
      data-slot={slot}
      className={className}
      onFocus={onFocus}
      onBlur={onBlur}
      onCloseAutoFocus={(event) => {
        // Radix calls this a task after the menu has gone, the focus having
        // fallen from it to the body. Found on an element, it was put there
        // since (a dialog an item opened, the checkbox of a SelectionBar an
        // item cleared), and taking it to the ⋯ would take it from there.
        const active = document.activeElement;
        if (active !== null && active !== document.body) {
          store.keepFocusOnClose = false;
          event.preventDefault();
          return;
        }
        // An item that opened its own surface has the focus, or is about to.
        if (!store.keepFocusOnClose) return;
        store.keepFocusOnClose = false;
        event.preventDefault();
      }}
    >
      {surface ? surface(items) : items}
    </DropdownMenuContent>
  );
}
