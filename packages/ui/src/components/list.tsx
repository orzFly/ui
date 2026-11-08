import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * What a list is for, which decides how each style draws it. `nav` moves
 * between places and marks the one on screen; `listbox` holds things to pick
 * and marks the ones picked; `menu` holds actions and marks only the one
 * under the pointer. The purpose says nothing to a screen reader: the markup
 * inside says that.
 */
type ListPurpose = "nav" | "listbox" | "menu";

const ListContext = React.createContext<{
  purpose: ListPurpose;
  orientation: "vertical" | "horizontal";
}>({ purpose: "nav", orientation: "vertical" });

// Under raymond a vertical nav or a listbox is a sunken white well whose
// current or picked row fills with the highlight, as Explorer's folder pane
// and a list box draw them; a horizontal nav is a toolbar whose buttons rise
// under the pointer and stay pressed while current; a menu sits on the face,
// its rows filling with the highlight only under the pointer. The highlight's
// text colour reaches a row's quiet text through --muted-foreground, and
// inside the row primary and its text colour swap, so a mark drawn in
// primary (an unread dot, a count) stays seen on the highlight; the swap
// goes through --list-highlight, as two properties naming each other would
// be a cycle and draw nothing.
const FRAME: Record<ListPurpose, Record<"vertical" | "horizontal", string>> = {
  nav: {
    vertical: "raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken",
    horizontal: "",
  },
  listbox: {
    vertical: "raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken",
    horizontal: "raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken",
  },
  menu: {
    vertical: "raymond:bg-(--3d-face)",
    horizontal: "raymond:bg-(--3d-face)",
  },
};

// Literal, not built from a shared string: Tailwind only generates the
// classes it finds written out.
const ITEM: Record<ListPurpose, Record<"vertical" | "horizontal", string>> = {
  nav: {
    vertical:
      "transition-colors hover:bg-accent data-current:bg-accent data-current:font-medium raymond:min-h-row raymond:touch:min-h-11 raymond:transition-none raymond:not-data-current:hover:bg-transparent raymond:data-current:font-normal raymond:data-current:bg-primary raymond:data-current:text-primary-foreground raymond:data-current:[--foreground:var(--primary-foreground)] raymond:data-current:[--muted-foreground:var(--primary-foreground)] raymond:data-current:[--border:var(--primary-foreground)] raymond:data-current:[--list-highlight:var(--primary)] raymond:data-current:[--list-highlight-text:var(--primary-foreground)] raymond:data-current:*:[--primary:var(--list-highlight-text)] raymond:data-current:*:[--primary-foreground:var(--list-highlight)]",
    horizontal:
      "border-b-2 border-transparent text-muted-foreground transition-colors hover:text-foreground data-current:border-primary data-current:font-medium data-current:text-foreground raymond:border-0 raymond:text-foreground raymond:transition-none raymond:hover:shadow-raised raymond:data-current:shadow-sunken raymond:data-current:hover:shadow-sunken",
  },
  listbox: {
    vertical:
      "transition-colors hover:bg-accent/60 data-selected:bg-accent raymond:border-transparent raymond:transition-none raymond:not-data-selected:hover:bg-transparent raymond:data-selected:bg-primary raymond:data-selected:text-primary-foreground raymond:data-selected:[--foreground:var(--primary-foreground)] raymond:data-selected:[--muted-foreground:var(--primary-foreground)] raymond:data-selected:[--border:var(--primary-foreground)] raymond:data-selected:[--list-highlight:var(--primary)] raymond:data-selected:[--list-highlight-text:var(--primary-foreground)] raymond:data-selected:*:[--primary:var(--list-highlight-text)] raymond:data-selected:*:[--primary-foreground:var(--list-highlight)]",
    horizontal:
      "transition-colors hover:bg-accent/60 data-selected:bg-accent raymond:border-transparent raymond:transition-none raymond:not-data-selected:hover:bg-transparent raymond:data-selected:bg-primary raymond:data-selected:text-primary-foreground raymond:data-selected:[--foreground:var(--primary-foreground)] raymond:data-selected:[--muted-foreground:var(--primary-foreground)] raymond:data-selected:[--border:var(--primary-foreground)] raymond:data-selected:[--list-highlight:var(--primary)] raymond:data-selected:[--list-highlight-text:var(--primary-foreground)] raymond:data-selected:*:[--primary:var(--list-highlight-text)] raymond:data-selected:*:[--primary-foreground:var(--list-highlight)]",
  },
  menu: {
    vertical:
      "transition-colors hover:bg-accent focus-visible:bg-accent raymond:transition-none raymond:hover:bg-primary raymond:hover:text-primary-foreground raymond:hover:[--foreground:var(--primary-foreground)] raymond:hover:[--muted-foreground:var(--primary-foreground)] raymond:hover:[--border:var(--primary-foreground)] raymond:focus-visible:bg-primary raymond:focus-visible:text-primary-foreground raymond:focus-visible:[--foreground:var(--primary-foreground)] raymond:focus-visible:[--muted-foreground:var(--primary-foreground)] raymond:focus-visible:[--border:var(--primary-foreground)]",
    horizontal:
      "transition-colors hover:bg-accent focus-visible:bg-accent raymond:transition-none raymond:hover:bg-primary raymond:hover:text-primary-foreground raymond:hover:[--foreground:var(--primary-foreground)] raymond:hover:[--muted-foreground:var(--primary-foreground)] raymond:hover:[--border:var(--primary-foreground)] raymond:focus-visible:bg-primary raymond:focus-visible:text-primary-foreground raymond:focus-visible:[--foreground:var(--primary-foreground)] raymond:focus-visible:[--muted-foreground:var(--primary-foreground)] raymond:focus-visible:[--border:var(--primary-foreground)]",
  },
};

const LABEL: Record<ListPurpose, string> = {
  nav: "font-medium text-muted-foreground text-ui-sm raymond:font-bold raymond:text-foreground",
  listbox:
    "font-medium text-muted-foreground text-ui-sm raymond:font-bold raymond:text-foreground",
  menu: "font-medium text-muted-foreground text-ui-sm raymond:text-foreground",
};

/**
 * A list's frame: the element its rows and group labels sit in, which a
 * style may draw as a well. With `asChild` it is the caller's own element (a
 * `nav`); the `ul`s go inside. A list that scrolls puts its scroller inside
 * the frame: a well's bevel is an inset shadow, which a scroller would paint
 * its rows over.
 */
function List({
  purpose = "nav",
  orientation = "vertical",
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  purpose?: ListPurpose;
  orientation?: "vertical" | "horizontal";
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "div";
  const context = React.useMemo(
    () => ({ purpose, orientation }),
    [purpose, orientation],
  );
  return (
    <ListContext.Provider value={context}>
      <Comp
        data-slot="list"
        data-purpose={purpose}
        data-orientation={orientation}
        className={cn(FRAME[purpose][orientation], className)}
        {...props}
      />
    </ListContext.Provider>
  );
}

/**
 * A row. `current` marks a nav's place on screen, `selected` a listbox's
 * picked rows; the caller still sets `aria-current` or its own state for a
 * screen reader. With `asChild` the row is the caller's link, button or `li`.
 */
function ListItem({
  current = false,
  selected = false,
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  current?: boolean;
  selected?: boolean;
  asChild?: boolean;
}) {
  const { purpose, orientation } = React.useContext(ListContext);
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="list-item"
      data-current={current || undefined}
      data-selected={selected || undefined}
      className={cn(ITEM[purpose][orientation], className)}
      {...props}
    />
  );
}

/** A heading between a list's groups. */
function ListLabel({ className, ...props }: React.ComponentProps<"h2">) {
  const { purpose } = React.useContext(ListContext);
  return (
    <h2
      data-slot="list-label"
      className={cn(LABEL[purpose], className)}
      {...props}
    />
  );
}

export { List, ListItem, ListLabel, type ListPurpose };
