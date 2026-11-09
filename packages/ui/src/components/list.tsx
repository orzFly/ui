import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * What a list is for, which decides how each style draws it. `listbox` holds
 * things to pick and marks the ones picked; `menu` holds actions and marks
 * only the one under the pointer; `collection` holds things the user keeps,
 * each row carrying its own actions, and marks none. Places to go are a
 * `NavList` or a `TabNav`.
 * The purpose says nothing to a screen reader: the markup inside says that.
 */
type ListPurpose = "listbox" | "menu" | "collection";

const ListContext = React.createContext<{
  purpose: ListPurpose;
  orientation: "vertical" | "horizontal";
}>({ purpose: "listbox", orientation: "vertical" });

// A listbox's picked row takes the accent fill, text and tick that every
// highlighted or selected row takes, a menu's or a table's included.
// Under raymond a listbox is a sunken white well whose picked rows fill with
// the highlight, as a list box draws them, and its bevel stands in for any
// border the caller gave the frame; a menu sits on the face, its rows filling
// with the highlight only under the pointer. The highlight's
// text colour reaches a row's quiet text through --muted-foreground, and
// inside the row primary and its text colour swap, so a mark drawn in
// primary (an unread dot, a count) stays seen on the highlight; the swap
// goes through --list-highlight, as two properties naming each other would
// be a cycle and draw nothing. A picked row's focus rectangle takes the
// highlight's text colour, as the black one vanishes on it.
// A collection's rows are parted by a rule; under raymond it is a list view,
// a sunken white well whose rows sit on it unruled.
const FRAME: Record<ListPurpose, Record<"vertical" | "horizontal", string>> = {
  listbox: {
    vertical:
      "raymond:border-0 raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken",
    horizontal:
      "raymond:border-0 raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken",
  },
  menu: {
    vertical: "raymond:bg-(--3d-face)",
    horizontal: "raymond:bg-(--3d-face)",
  },
  collection: {
    vertical:
      "raymond:border-0 raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken",
    horizontal:
      "raymond:border-0 raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken",
  },
};

// Literal, not built from a shared string: Tailwind only generates the
// classes it finds written out.
const ITEM: Record<ListPurpose, Record<"vertical" | "horizontal", string>> = {
  listbox: {
    vertical:
      "transition-colors hover:bg-accent/60 data-selected:bg-accent data-selected:text-accent-foreground data-selected:state-cue raymond:border-transparent raymond:transition-none raymond:not-data-selected:hover:bg-transparent raymond:data-selected:bg-primary raymond:data-selected:text-primary-foreground raymond:data-selected:[--ring:var(--primary-foreground)] raymond:data-selected:[--foreground:var(--primary-foreground)] raymond:data-selected:[--muted-foreground:var(--primary-foreground)] raymond:data-selected:[--border:var(--primary-foreground)] raymond:data-selected:[--list-highlight:var(--primary)] raymond:data-selected:[--list-highlight-text:var(--primary-foreground)] raymond:data-selected:*:[--primary:var(--list-highlight-text)] raymond:data-selected:*:[--primary-foreground:var(--list-highlight)]",
    horizontal:
      "transition-colors hover:bg-accent/60 data-selected:bg-accent data-selected:text-accent-foreground data-selected:state-cue raymond:border-transparent raymond:transition-none raymond:not-data-selected:hover:bg-transparent raymond:data-selected:bg-primary raymond:data-selected:text-primary-foreground raymond:data-selected:[--ring:var(--primary-foreground)] raymond:data-selected:[--foreground:var(--primary-foreground)] raymond:data-selected:[--muted-foreground:var(--primary-foreground)] raymond:data-selected:[--border:var(--primary-foreground)] raymond:data-selected:[--list-highlight:var(--primary)] raymond:data-selected:[--list-highlight-text:var(--primary-foreground)] raymond:data-selected:*:[--primary:var(--list-highlight-text)] raymond:data-selected:*:[--primary-foreground:var(--list-highlight)]",
  },
  menu: {
    vertical:
      "transition-colors hover:bg-accent focus-visible:bg-accent raymond:transition-none raymond:hover:bg-primary raymond:hover:text-primary-foreground raymond:hover:[--foreground:var(--primary-foreground)] raymond:hover:[--muted-foreground:var(--primary-foreground)] raymond:hover:[--border:var(--primary-foreground)] raymond:focus-visible:bg-primary raymond:focus-visible:text-primary-foreground raymond:focus-visible:[--foreground:var(--primary-foreground)] raymond:focus-visible:[--muted-foreground:var(--primary-foreground)] raymond:focus-visible:[--border:var(--primary-foreground)]",
    horizontal:
      "transition-colors hover:bg-accent focus-visible:bg-accent raymond:transition-none raymond:hover:bg-primary raymond:hover:text-primary-foreground raymond:hover:[--foreground:var(--primary-foreground)] raymond:hover:[--muted-foreground:var(--primary-foreground)] raymond:hover:[--border:var(--primary-foreground)] raymond:focus-visible:bg-primary raymond:focus-visible:text-primary-foreground raymond:focus-visible:[--foreground:var(--primary-foreground)] raymond:focus-visible:[--muted-foreground:var(--primary-foreground)] raymond:focus-visible:[--border:var(--primary-foreground)]",
  },
  collection: {
    vertical: "not-first:border-t raymond:border-t-0 raymond:px-1.5",
    horizontal: "not-first:border-l raymond:border-l-0 raymond:px-1.5",
  },
};

const LABEL: Record<ListPurpose, string> = {
  listbox:
    "font-medium text-muted-foreground text-ui-sm raymond:font-bold raymond:text-foreground",
  menu: "font-medium text-muted-foreground text-ui-sm raymond:text-foreground",
  collection:
    "font-medium text-muted-foreground text-ui-sm raymond:font-bold raymond:text-foreground",
};

/**
 * A list's frame: the element its rows and group labels sit in, which a
 * style may draw as a well. With `asChild` it is the caller's own element;
 * the `ul`s go inside. A list that scrolls puts its scroller inside the
 * frame: a well's bevel is an inset shadow, which a scroller would paint its
 * rows over.
 */
function List({
  purpose,
  orientation = "vertical",
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  purpose: ListPurpose;
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
        className={cn("text-ui", FRAME[purpose][orientation], className)}
        {...props}
      />
    </ListContext.Provider>
  );
}

/**
 * A row. `selected` marks a listbox's picked rows; the caller still sets
 * `aria-selected` or its own state for a screen reader. With `asChild` the
 * row is the caller's button or `li`; a collection's row is the `li`, the
 * rule between rows going on each one after the first.
 */
function ListItem({
  selected = false,
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  selected?: boolean;
  asChild?: boolean;
}) {
  const { purpose, orientation } = React.useContext(ListContext);
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="list-item"
      data-selected={selected || undefined}
      className={cn(
        "outline-none focus-visible:focus-ring-inset",
        ITEM[purpose][orientation],
        className,
      )}
      {...props}
    />
  );
}

/**
 * A heading between a list's groups. `asChild` renders the heading element the page's outline
 * needs (`h3`).
 */
function ListLabel({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"h2"> & { asChild?: boolean }) {
  const { purpose } = React.useContext(ListContext);
  const Comp = asChild ? Slot.Root : "h2";
  return (
    <Comp
      data-slot="list-label"
      className={cn(LABEL[purpose], className)}
      {...props}
    />
  );
}

export { List, ListItem, ListLabel, type ListPurpose };
