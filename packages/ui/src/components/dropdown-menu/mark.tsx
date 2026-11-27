import { CheckIcon } from "lucide-react";
import type * as React from "react";

/** The padding a row keeps for its `MarkPlace`, whether or not it is marked. */
export const MARK_ROOM = "pr-8 raymond:pr-2 raymond:pl-6";

/**
 * Where a row's mark stands: at its end, under raymond at its start, in the
 * room `MARK_ROOM` keeps for it.
 */
export function MarkPlace({
  slot,
  children,
}: {
  slot: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className="pointer-events-none absolute right-2 flex items-center justify-center raymond:right-auto raymond:left-1.5"
      data-slot={slot}
    >
      {children}
    </span>
  );
}

/**
 * The mark of the one chosen of several: a check, and under raymond a
 * bullet, the check staying with an item that is ticked on its own.
 */
export function ChoiceMark() {
  return (
    <>
      <CheckIcon className="raymond:hidden" />
      <span className="hidden size-1.5 rounded-full bg-current raymond:block" />
    </>
  );
}
