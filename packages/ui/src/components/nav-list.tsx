import { ChevronDownIcon } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";

import { isPlainPress } from "../lib/link.ts";
import { cn } from "../lib/utils.ts";

/**
 * How a column of places is drawn. `rows` tiles full rows, the current one in the state fill
 * and cue: an app's folders, a site's pages. `rail` hangs quiet lines off a rule down their
 * leading edge, the current one laying the state cue over the rule: the sections of the page in
 * view, beside the page. A rail's rows take the size of the text around them.
 */
type NavListVariant = "rows" | "rail";

const NavListContext = React.createContext<NavListVariant>("rows");

interface GroupContextValue {
  contentId: string;
  state: "auto" | "open" | "closed";
  expanded: boolean;
  setOpen: (open: boolean) => void;
  setContent: (content: HTMLElement | null) => void;
}

const GroupContext = React.createContext<GroupContextValue | null>(null);

interface GroupRowContextValue {
  placeId: string | undefined;
  setPlaceId: (id: string) => void;
  onPlaceClick: (event: React.MouseEvent<HTMLElement>) => void;
}

const GroupRowContext = React.createContext<GroupRowContextValue | null>(null);

/**
 * A column of places to go: an app's folders, a settings screen's sections, a document's parts.
 * Rows tile with no gap; the current one takes the state fill and the state cue, or with
 * `variant="rail"` the state cue alone, over the rule. Put it in a `nav` named with `aria-label`, and head
 * each group with a `NavListHeading`.
 */
function NavList({
  variant = "rows",
  className,
  ...props
}: React.ComponentProps<"ul"> & { variant?: NavListVariant }) {
  return (
    <NavListContext.Provider value={variant}>
      <ul
        data-slot="nav-list"
        data-variant={variant}
        // Under raymond a rail is a list in its frame's well, as rows are.
        className={cn(
          "flex flex-col",
          variant === "rail" && "border-l raymond:border-l-0",
          className,
        )}
        {...props}
      />
    </NavListContext.Provider>
  );
}

/**
 * The frame an app's own column of places sits in, around its `nav` and every list and heading
 * inside, which a style may draw as a well. With `asChild` it is the `nav` itself. A nav that
 * scrolls puts its scroller inside the frame: a well's bevel is an inset shadow, which a
 * scroller would paint its rows over.
 */
function NavListFrame({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="nav-list-frame"
      // Under raymond a sunken well in the window colour, as Explorer draws
      // its folder pane.
      className={cn(
        "raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken raymond:[--tree-ground:var(--window)]",
        className,
      )}
      {...props}
    />
  );
}

function NavListItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="nav-list-item" className={className} {...props} />;
}

/**
 * One place. `current` marks the place on screen and sets `aria-current`, `"page"` unless given
 * another token (`"location"` for a part of the document in view). `asChild` renders a router's
 * link, or a `button` for a place that is app state rather than a URL. `depth` indents a nested
 * place one step per level. Lead with an icon and end with a `NavListCount` as needed.
 */
/** One step of indent per level of nesting, past the row's own padding. */
const indent = (
  depth: number,
  style: React.CSSProperties | undefined,
  step = 4,
) =>
  depth > 0
    ? { paddingLeft: `calc(var(--spacing) * ${3 + depth * step})`, ...style }
    : style;

const LINK: Record<NavListVariant, string> = {
  rows: "relative flex min-h-row w-full items-center gap-2 px-3 text-left text-ui text-muted-foreground transition-colors outline-none select-none hover:bg-accent hover:text-accent-foreground focus-visible:focus-ring-inset touch:min-h-touch data-current:bg-accent data-current:font-medium data-current:text-accent-foreground data-current:state-cue [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  rail: "-ml-px flex min-h-7 items-center gap-2 py-1 pl-3 text-left text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:focus-ring touch:min-h-touch data-current:text-foreground data-current:state-cue [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 raymond:ml-0 raymond:min-h-row raymond:touch:min-h-touch raymond:py-0 raymond:[--focus-offset:-1px]",
};

function NavListLink({
  className,
  current,
  depth = 0,
  asChild = false,
  style,
  ...props
}: React.ComponentProps<"a"> & {
  current?: boolean | "page" | "location" | "true";
  depth?: number;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "a";
  const variant = React.useContext(NavListContext);
  const row = React.useContext(GroupRowContext);
  const ownId = React.useId();
  const id = props.id ?? ownId;
  const setPlaceId = row?.setPlaceId;
  React.useLayoutEffect(() => {
    setPlaceId?.(id);
  }, [setPlaceId, id]);
  const onClick = props.onClick;
  return (
    <Comp
      data-slot="nav-list-link"
      data-current={current ? "" : undefined}
      aria-current={current === true ? "page" : current || undefined}
      style={indent(depth, style, variant === "rail" ? 3 : 4)}
      className={cn(
        LINK[variant],
        // Under raymond the rows are a tree's or a list box's: black on the
        // well with no hover, the current one filled with the highlight, its
        // quiet text and a primary mark inside swapped onto it as List's are,
        // and its focus rectangle drawn in the highlight's text colour.
        "raymond:text-foreground raymond:transition-none raymond:not-data-current:hover:bg-transparent raymond:not-data-current:hover:text-foreground raymond:data-current:bg-primary raymond:data-current:font-normal raymond:data-current:text-primary-foreground raymond:data-current:[--ring:var(--primary-foreground)] raymond:data-current:[--foreground:var(--primary-foreground)] raymond:data-current:[--muted-foreground:var(--primary-foreground)] raymond:data-current:[--list-highlight:var(--primary)] raymond:data-current:[--list-highlight-text:var(--primary-foreground)] raymond:data-current:*:[--primary:var(--list-highlight-text)] raymond:data-current:*:[--primary-foreground:var(--list-highlight)]",
        // A group's place shares its row with the toggle. While the group is
        // closed over the current place the row takes the current fill and
        // the link the text and cue, so its own hover fill keeps the cue.
        row &&
          "min-w-0 flex-1 pr-1 group-data-[state=closed]/nav-list-group:group-has-[[data-slot=nav-list-group-content]_[aria-current]]/nav-list-group:font-medium group-data-[state=closed]/nav-list-group:group-has-[[data-slot=nav-list-group-content]_[aria-current]]/nav-list-group:text-accent-foreground group-data-[state=closed]/nav-list-group:group-has-[[data-slot=nav-list-group-content]_[aria-current]]/nav-list-group:state-cue raymond:group-data-[state=closed]/nav-list-group:group-has-[[data-slot=nav-list-group-content]_[aria-current]]/nav-list-group:font-normal raymond:group-data-[state=closed]/nav-list-group:group-has-[[data-slot=nav-list-group-content]_[aria-current]]/nav-list-group:text-primary-foreground",
        className,
      )}
      {...props}
      id={row ? id : props.id}
      onClick={
        row
          ? (event: React.MouseEvent<HTMLAnchorElement>) => {
              onClick?.(event);
              row.onPlaceClick(event);
            }
          : onClick
      }
    />
  );
}

/** A place's count, unread or waiting, at the row's end. */
function NavListCount({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="nav-list-count"
      className={cn(
        "ml-auto text-ui-sm font-normal tabular-nums text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A group's heading, above the `NavList` it names. `asChild` renders the heading element the
 * page's outline needs (`h2`, `h3`); a link inside it, to the group's own page, underlines
 * on hover. `depth` indents it with the places it heads.
 */
function NavListHeading({
  className,
  depth = 0,
  asChild = false,
  style,
  ...props
}: React.ComponentProps<"div"> & { depth?: number; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="nav-list-heading"
      style={indent(depth, style)}
      className={cn(
        "flex min-h-row items-end px-3 pt-3 pb-1 text-ui-sm font-semibold text-foreground [&_a]:underline-offset-4 [&_a:hover]:underline raymond:font-bold",
        className,
      )}
      {...props}
    />
  );
}

function useGroup(part: string) {
  const group = React.useContext(GroupContext);
  if (!group) throw new Error(`${part} renders inside a NavListGroup`);
  return group;
}

/**
 * A group of places the reader can close: its head, a `NavListGroupRow` or a `NavListHeading`
 * holding a `NavListGroupToggle`, then a `NavListGroupContent`. Until the reader opens or closes
 * it, it is open exactly while it holds the current place; `defaultOpen` starts it open or
 * closed instead, and `open` with `onOpenChange` controls it. `asChild` makes the caller's
 * element the group, such as the `NavListItem` it sits in. A group holds no other group.
 */
function NavListGroup({
  open,
  defaultOpen,
  onOpenChange,
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "div";
  const contentId = React.useId();
  const [chosen, setChosen] = React.useState(defaultOpen);
  const [holdsCurrent, setHoldsCurrent] = React.useState(false);
  const [content, setContent] = React.useState<HTMLElement | null>(null);

  // Only aria-expanded waits for this. Until the reader chooses, what shows
  // is the stylesheet's, from :has([aria-current]), so the first frame
  // rendered on the server is already open over the current place.
  React.useLayoutEffect(() => {
    if (!content) return;
    const check = () =>
      setHoldsCurrent(content.querySelector("[aria-current]") !== null);
    check();
    const observer = new MutationObserver(check);
    observer.observe(content, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-current"],
    });
    return () => observer.disconnect();
  }, [content]);

  const controlled = open !== undefined;
  const expanded = controlled ? open : (chosen ?? holdsCurrent);
  const chosenOpen = controlled ? open : chosen;
  const state =
    chosenOpen === undefined ? "auto" : chosenOpen ? "open" : "closed";
  const setOpen = (next: boolean) => {
    if (!controlled) setChosen(next);
    onOpenChange?.(next);
  };

  return (
    <GroupContext.Provider
      value={{ contentId, state, expanded, setOpen, setContent }}
    >
      <Comp
        {...props}
        data-slot="nav-list-group"
        data-state={state}
        className={cn("group/nav-list-group", className)}
      />
    </GroupContext.Provider>
  );
}

/**
 * A group's head when the group is a place: its `NavListLink`, then an icon-only
 * `NavListGroupToggle`. A plain click on the link opens the group, and never closes it.
 */
function NavListGroupRow({ className, ...props }: React.ComponentProps<"div">) {
  const group = useGroup("NavListGroupRow");
  const [placeId, setPlaceId] = React.useState<string>();
  const onPlaceClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!group.expanded && isPlainPress(event)) group.setOpen(true);
  };
  return (
    <GroupRowContext.Provider value={{ placeId, setPlaceId, onPlaceClick }}>
      <div
        {...props}
        data-slot="nav-list-group-row"
        // Closed over the current place, the row is drawn as the current
        // place's: the fill here, the text and cue on its link. raymond
        // fills it with the highlight; the +/- box keeps its own white.
        className={cn(
          "flex items-stretch group-data-[state=closed]/nav-list-group:group-has-[[data-slot=nav-list-group-content]_[aria-current]]/nav-list-group:bg-accent raymond:group-data-[state=closed]/nav-list-group:group-has-[[data-slot=nav-list-group-content]_[aria-current]]/nav-list-group:bg-primary raymond:group-data-[state=closed]/nav-list-group:group-has-[[data-slot=nav-list-group-content]_[aria-current]]/nav-list-group:[--muted-foreground:var(--primary-foreground)] raymond:group-data-[state=closed]/nav-list-group:group-has-[[data-slot=nav-list-group-content]_[aria-current]]/nav-list-group:[--ring:var(--primary-foreground)]",
          className,
        )}
      />
    </GroupRowContext.Provider>
  );
}

/**
 * Opens and closes its `NavListGroup`. With children it is the whole text of the
 * `NavListHeading` it sits in; without, an icon button at the end of a `NavListGroupRow`, named
 * after the row's link unless given `aria-label`.
 */
function NavListGroupToggle({
  className,
  children,
  onClick,
  ...props
}: Omit<React.ComponentProps<"button">, "type">) {
  const group = useGroup("NavListGroupToggle");
  const row = React.useContext(GroupRowContext);
  const named =
    props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined;
  const icon = children === undefined || children === null;
  // Drawn open by the stylesheet rather than by `expanded`, so a group the
  // reader has not touched is right in its first frame.
  const marker = (
    <>
      <ChevronDownIcon
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover/nav-list-toggle:text-foreground group-data-[state=open]/nav-list-group:rotate-180 group-data-[state=auto]/nav-list-group:group-has-[[data-slot=nav-list-group-content]_[aria-current]]/nav-list-group:rotate-180 motion-reduce:transition-none raymond:hidden"
      />
      {/* tree.tsx's 9px box, written again because the tree's is placed on
            its connecting lines and this one ends the row. */}
      <span className="relative hidden size-[9px] shrink-0 border border-(--3d-shadow) bg-(--window) before:absolute before:inset-x-px before:top-[3px] before:h-px before:bg-foreground after:absolute after:inset-y-px after:left-[3px] after:w-px after:bg-foreground raymond:block group-data-[state=open]/nav-list-group:after:hidden group-data-[state=auto]/nav-list-group:group-has-[[data-slot=nav-list-group-content]_[aria-current]]/nav-list-group:after:hidden" />
    </>
  );
  return (
    <button
      {...props}
      type="button"
      data-slot="nav-list-group-toggle"
      aria-expanded={group.expanded}
      aria-controls={group.contentId}
      aria-labelledby={named ? props["aria-labelledby"] : row?.placeId}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) group.setOpen(!group.expanded);
      }}
      className={cn(
        "group/nav-list-toggle outline-none",
        icon
          ? // A square the row's height, which grows to the touch spacing
            // with the row. Under raymond the tree view's box, with no hover.
            "flex w-row shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:focus-ring-inset touch:w-touch raymond:transition-none raymond:hover:bg-transparent raymond:focus-visible:focus-ring raymond:[--focus-offset:-1px]"
          : // The heading's whole text, reaching back over the heading's
            // padding so the cue of a group closed over the current place
            // sits on the row's edge, where a current link draws its own.
            "relative -mx-3 flex min-w-0 flex-1 items-center gap-2 pl-3 text-left focus-visible:focus-ring touch:hit-area group-data-[state=closed]/nav-list-group:group-has-[[data-slot=nav-list-group-content]_[aria-current]]/nav-list-group:state-cue",
        className,
      )}
    >
      {!icon && (
        // raymond has no cue; it highlights the words alone, as a tree view
        // does its current item's.
        <span className="min-w-0 truncate raymond:-mx-0.5 raymond:px-0.5 raymond:group-data-[state=closed]/nav-list-group:group-has-[[data-slot=nav-list-group-content]_[aria-current]]/nav-list-group:bg-primary raymond:group-data-[state=closed]/nav-list-group:group-has-[[data-slot=nav-list-group-content]_[aria-current]]/nav-list-group:text-primary-foreground">
          {children}
        </span>
      )}
      {icon ? (
        marker
      ) : (
        // The square an icon-only toggle is, so the markers of both kinds
        // of head line up down the list.
        <span className="ml-auto flex w-row shrink-0 items-center justify-center touch:w-touch">
          {marker}
        </span>
      )}
    </button>
  );
}

/** A `NavListGroup`'s places, kept in the page while closed. */
function NavListGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const group = useGroup("NavListGroupContent");
  return (
    <div
      {...props}
      ref={group.setContent}
      id={group.contentId}
      hidden={group.state === "closed"}
      data-slot="nav-list-group-content"
      className={cn(
        "group-data-[state=auto]/nav-list-group:not-has-[[aria-current]]:hidden",
        className,
      )}
    />
  );
}

export {
  NavList,
  NavListCount,
  NavListFrame,
  NavListGroup,
  NavListGroupContent,
  NavListGroupRow,
  NavListGroupToggle,
  NavListHeading,
  NavListItem,
  NavListLink,
  type NavListVariant,
};
