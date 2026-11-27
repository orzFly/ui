"use client";

import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/utils.ts";
import { DropdownMenu } from "./dropdown-menu.tsx";
import { OverflowMenu } from "./overflow/menu.tsx";
import { useOverflowPart } from "./overflow/part.ts";
import { useOverflowRoot } from "./overflow/root.ts";
import { OUT_OF_FLOW, slotProps, useComposedRef } from "./overflow/util.ts";
import { TAB } from "./tab-nav/look.ts";
import {
  ariaCurrent,
  type TabNavLinkProps,
  TabNavMenuItem,
  TabNavOverflowTrigger,
} from "./tab-nav/overflow.tsx";
import {
  TabNavContext,
  type TabNavMeta,
  TabNavStore,
} from "./tab-nav/store.ts";

/**
 * A row of links to an app's sections, drawn as a line of tabs: the current one is underlined
 * on the row's rule. Laid flush against the bottom of a ruled header, its rule lands on the
 * header's. Name it with `aria-label`, as any `nav`.
 *
 * What does not fit goes into a ⋯ at the row's end, from the last link back, the current one
 * last; the ⋯ wears the current mark once that one is in it. How many fit follows the widths
 * the style and the pointer draw them at. In a row of other parts it takes the room its links
 * need before anything that grows beside it, and gives it up down to the current link and the
 * ⋯ before anything beside it shrinks; it never grows past its links.
 */
function TabNav({
  className,
  overflowLabel = "More sections",
  overflowCurrentLabel = defaultCurrentLabel,
  children,
  ref,
  ...props
}: React.ComponentProps<"nav"> & {
  /** The ⋯ button's name. */
  overflowLabel?: string;
  /** Its name while the current link is folded into it. */
  overflowCurrentLabel?: (current: string) => string;
}) {
  const [store] = React.useState(() => new TabNavStore());
  useOverflowRoot(store);
  const measured = React.useSyncExternalStore(
    store.subscribe,
    () => store.measured,
    () => false,
  );
  const open = React.useSyncExternalStore(
    store.subscribe,
    () => store.overflowOpen,
    () => false,
  );
  const rowRef = React.useCallback(
    (el: HTMLElement | null) => {
      if (store.row && store.row !== el) store.unobserve(store.row);
      store.row = el;
      if (el) store.observe(el);
    },
    [store],
  );
  const composed = useComposedRef(ref, rowRef);
  return (
    <TabNavContext.Provider value={store}>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => store.setOverflowOpen(next)}
      >
        <nav
          ref={composed}
          data-slot="tab-nav"
          className={cn(
            // Under raymond the row is a links bar: no rule, the links flat
            // buttons. On touch the row is the touch spacing tall, its links
            // filling it. Nothing transitions in the frame a new layout is
            // drawn in (`OverflowStore`'s `markRelayout`).
            "relative -mb-px flex items-stretch self-stretch border-b touch:min-h-touch data-relayout:**:transition-none raymond:mb-0 raymond:border-b-0",
            measured
              ? // Its room in a row: none to start from, so a shortfall
                // falls on the parts beside it first, down to its least;
                // first claim on what is spare, up to its links' width,
                // which a parent sized by its content reads too.
                "grow-1000 basis-0 w-(--tab-nav-full) max-w-[min(var(--tab-nav-full),100%)] min-w-[min(var(--tab-nav-least),100%)]"
              : // Not measured yet (a prerendered page): one line, cut off
                // at its edge.
                "min-w-0 overflow-x-clip",
            className,
          )}
          {...props}
        >
          {children}
          <TabNavOverflowTrigger
            store={store}
            label={overflowLabel}
            currentLabel={overflowCurrentLabel}
          />
        </nav>
        <OverflowMenu
          store={store}
          align="start"
          data-slot="tab-nav-overflow-content"
          className="w-auto min-w-44"
        />
      </DropdownMenu>
    </TabNavContext.Provider>
  );
}

function defaultCurrentLabel(current: string) {
  return `More sections (current: ${current})`;
}

/** The text written straight into a node, leaving out its elements: an icon, a count. */
function ownText(node: React.ReactNode): string {
  return React.Children.toArray(node)
    .filter((each) => typeof each === "string" || typeof each === "number")
    .join("")
    .trim();
}

/**
 * One section's link. `current` marks the section the reader is in, which need not be the
 * linked page itself; it sets `aria-current`, `"page"` unless given another token. `asChild`
 * renders a router's link in its place. In a `TabNav`, it goes into the ⋯ menu when it does not
 * fit, as the same link with the same props and content; its `className` and `style` stay with
 * the row.
 */
function TabNavLink({
  className,
  style,
  id,
  current,
  asChild = false,
  children,
  ref,
  ...props
}: TabNavLinkProps) {
  const store = React.useContext(TabNavContext);
  const child = asChild && React.isValidElement(children) ? children : null;
  const childProps = (child?.props ?? {}) as {
    "aria-label"?: string;
    children?: React.ReactNode;
  };
  const name =
    props["aria-label"] ??
    childProps["aria-label"] ??
    ownText(child ? childProps.children : children);
  const part = useOverflowPart<TabNavMeta>({
    store,
    enabled: store !== null,
    kind: "link",
    meta: {
      overflowable: true,
      current: Boolean(current),
      name,
      renderOverflow: () => (
        <TabNavMenuItem current={current} asChild={asChild} {...props}>
          {children}
        </TabNavMenuItem>
      ),
    },
  });
  const overflowed = part.view === "overflow";
  const composed = useComposedRef(ref, part.ref);
  const Comp = asChild ? Slot.Root : "a";
  return (
    <Comp
      ref={composed}
      id={id}
      style={style}
      data-slot="tab-nav-link"
      data-current={current ? "" : undefined}
      aria-current={ariaCurrent(current)}
      {...slotProps(overflowed)}
      aria-hidden={overflowed || undefined}
      className={cn(TAB, overflowed && OUT_OF_FLOW, className)}
      {...props}
    >
      {children}
    </Comp>
  );
}

export { TabNav, TabNavLink };
