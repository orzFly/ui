import { EllipsisIcon } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "../../lib/utils.ts";
import { ChoiceMark, MARK_ROOM, MarkPlace } from "../dropdown-menu/mark.tsx";
import { DropdownMenuItem, DropdownMenuTrigger } from "../dropdown-menu.tsx";
import { OUT_OF_FLOW } from "../overflow/util.ts";
import { CommandTooltip } from "../toolbar/command.tsx";
import { TAB } from "./look.ts";
import type { TabNavStore } from "./store.ts";

/**
 * The ⋯: a tab at the row's end, wearing the current mark while the current
 * link is in its menu. While nothing is folded it stays in the row out of
 * sight, so its width is always there to measure.
 */
export function TabNavOverflowTrigger({
  store,
  label,
  currentLabel,
}: {
  store: TabNavStore;
  label: string;
  currentLabel: (current: string) => string;
}) {
  const more = React.useSyncExternalStore(
    store.subscribe,
    () => store.result.more,
    () => false,
  );
  const currentFolded = React.useSyncExternalStore(
    store.subscribe,
    () => store.result.currentFolded,
    () => false,
  );
  const currentName = React.useSyncExternalStore(
    store.subscribe,
    () => store.result.currentName,
    () => null,
  );
  const name =
    currentFolded && currentName !== null ? currentLabel(currentName) : label;
  return (
    <DropdownMenuTrigger asChild>
      {/* Always mounted, as a tooltip that came and went would remount the
          button and drop its focus. */}
      <CommandTooltip enabled text={name}>
        <button
          ref={store.triggerRef}
          type="button"
          data-slot="tab-nav-overflow-trigger"
          data-overflow-internal=""
          data-current={currentFolded ? "" : undefined}
          aria-label={name}
          {...(more ? {} : { inert: true, "aria-hidden": true })}
          className={cn(
            TAB,
            "touch:min-w-touch aria-expanded:text-foreground raymond:aria-expanded:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)]",
            !more && OUT_OF_FLOW,
          )}
        >
          <EllipsisIcon />
        </button>
      </CommandTooltip>
    </DropdownMenuTrigger>
  );
}

export type TabNavLinkProps = React.ComponentProps<"a"> & {
  current?: boolean | "page" | "location";
  asChild?: boolean;
};

/** What `aria-current` a link's `current` sets. */
export const ariaCurrent = (current: TabNavLinkProps["current"]) =>
  current === true ? "page" : current || undefined;

/**
 * A folded link's row in the ⋯ menu: the same link, its own props and
 * content, or under `asChild` the caller's element with the row's content.
 * Every row keeps the mark's room, so the names line up.
 */
export function TabNavMenuItem({
  current,
  asChild = false,
  children,
  ...link
}: Omit<TabNavLinkProps, "className" | "style" | "id" | "ref">) {
  const mark = current ? (
    <MarkPlace slot="tab-nav-menu-mark">
      <ChoiceMark />
    </MarkPlace>
  ) : null;
  const row =
    asChild &&
    React.isValidElement<{ children?: React.ReactNode }>(children) ? (
      <Slot.Root {...link} aria-current={ariaCurrent(current)}>
        {React.cloneElement(children, undefined, mark, children.props.children)}
      </Slot.Root>
    ) : (
      <a {...link} aria-current={ariaCurrent(current)}>
        {mark}
        {children}
      </a>
    );
  return (
    <DropdownMenuItem asChild className={MARK_ROOM}>
      {row}
    </DropdownMenuItem>
  );
}
