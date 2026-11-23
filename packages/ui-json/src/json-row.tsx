// Ported from PicoTera (BSD-3-Clause); see NOTICE.
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import { cn } from "@orz/ui/lib/utils";
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import { type CSSProperties, memo, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import type { JsonViewLabels } from "./labels.ts";
import {
  formatChars,
  isContainer,
  type JsonKind,
  type JsonNodeRow,
  type JsonRow,
} from "./tree.ts";
import type { JsonSummaryToken } from "./types.ts";

const VALUE_CLASS: Record<JsonKind, string> = {
  string: "text-warning",
  number: "text-success",
  boolean: "text-primary",
  null: "text-muted-foreground",
  object: "text-muted-foreground",
  array: "text-muted-foreground",
};

const TOKEN_CLASS: Record<JsonSummaryToken["kind"], string> = {
  name: "font-semibold text-foreground",
  key: "text-muted-foreground",
  punct: "text-muted-foreground",
  value: "text-foreground",
};

/**
 * The colour of a container row's last segment. Under wrap the ellipsis takes the row's colour,
 * and the cut almost always lands in the last segment, so the row takes that segment's colour.
 */
function containerTailClass(row: JsonNodeRow): string {
  const summary = row.summary;
  if (summary?.text) return "text-muted-foreground";
  if (summary?.args) return TOKEN_CLASS.value;
  if (summary?.name) return "text-foreground";
  const lastTag = summary?.tags.at(-1);
  if (lastTag) {
    return lastTag.emphasis ? "text-foreground" : "text-muted-foreground";
  }
  return VALUE_CLASS[row.kind];
}

/**
 * Splits text on the search needle, marking each match as FilterMenu marks its own. Runs only for
 * the rows on screen.
 */
function Highlight({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>;
  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (;;) {
    const at = lower.indexOf(needle, cursor);
    if (at < 0) break;
    if (at > cursor) parts.push(text.slice(cursor, at));
    parts.push(
      <mark
        key={at}
        className="bg-transparent font-semibold text-inherit underline decoration-primary/60 underline-offset-2"
      >
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    cursor = at + needle.length;
  }
  if (parts.length === 0) return <>{text}</>;
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/** A row's height, from the style's dense row; the touch row is `Tree`'s. */
export const ROW_HEIGHT_CLASS = "h-row-dense touch:h-11";

/** The left edge of a row's content at `depth`: 6px, then 12px a level. */
export const indentOf = (depth: number) =>
  `calc(var(--spacing) * ${1.5 + Math.max(0, depth) * 3})`;

// A selection is one shape. Each piece of it (a key, a value from where it
// starts, a member's row from the members' indent) draws one box twice: its
// edge, a primary border, and above every piece's edge its fill, a clear
// border of the same width with the accent inside. Drawn as borders, the
// frame snaps to the device's pixels as every other border does: at a
// fractional scale a layer 1px larger than the fill drew it one pixel wide
// on some sides and two on others. A box starts 1px out from its piece on
// the left, top and bottom and ends with the ⋯'s room, inside the view, so
// the boxes of two pieces in a row overlap by 2px, each fill covers the
// other's edge there, and one contour runs round the whole. A fill the
// selection goes on below reaches 2px further: under a scale below 1 a
// border is wider than 1px. The layers share the tree's stacking context,
// which is why rows are placed by `top` rather than a transform, and they
// sit above every row's own background, so a hovered neighbour cannot cover
// the contour; text sits above the fills. Under raymond the highlight,
// white on navy, with no frame.
const EDGE =
  "before:absolute before:z-1 before:border before:border-primary before:content-['']";
const FILL =
  "after:absolute after:z-2 after:border after:border-transparent after:bg-accent after:bg-clip-padding after:content-[''] raymond:after:bg-primary";
/**
 * A value's piece: its element, and the ⋯'s room after the row's content, which the selection's
 * ⋯ stands in.
 */
const PIECE = cn(
  EDGE,
  FILL,
  "before:-inset-y-px before:-left-px before:right-[calc(-1*var(--json-slot))] after:-top-px after:-bottom-px after:-left-px after:right-[calc(-1*var(--json-slot))]",
);
/**
 * A key's piece, which meets no other: its frame is drawn inside the room its padding makes, so
 * it stays clear of the colon after it.
 */
const KEY_PIECE = cn(EDGE, FILL, "before:inset-0 after:inset-0");
const JOINS_NEXT = "after:-bottom-[3px]";
/**
 * The ⋯'s room after every row's content: its margins and the button, as `--json-slot` on the
 * rows' box. On touch its end margin is the rest of its hit area, which the view would clip
 * where the ⋯ is held to the view's right edge. Its margins replace the room an icon button
 * keeps on both sides on touch: the selection's frame is built from them, and its only
 * neighbour is its own row, a target wider than 44px.
 */
export const SLOT_ROOM =
  "[--json-slot:calc(var(--spacing-control-xs)+var(--spacing))] touch:[--json-slot:calc(var(--spacing-control-xs)+var(--spacing)/2+var(--spacing-hit-xs))]";
const SLOT = "mx-0.5 flex-none touch:mr-hit-xs";
/**
 * A ⋯ held to the view's right edge stands in from it on touch by the rest of its hit area, which
 * the view would clip, and draws its own ground over that room, so the text of a long row it is
 * held over does not show beside it.
 */
const HELD = cn(
  "sticky right-0 touch:right-hit-xs",
  "touch:before:absolute touch:before:inset-y-0 touch:before:left-full touch:before:w-hit-xs touch:before:bg-inherit touch:before:content-['']",
);
/**
 * A ⋯ on the last line of what it stands beside, held to the view's bottom edge while that runs
 * past it: a wrapped row's own, and the selection's, which a tap on the row's ⋯ opens in its place.
 * Its margins make it as tall as a line, the touch row's 44px under touch: a wrapped row is as
 * tall as its lines rather than the button, and a held ⋯ rises no higher than the first line, so
 * a row barely in view shows no ⋯ ahead of its text. Held on touch, it stands its margin above
 * the edge, which would clip the rest of its hit area.
 */
const ON_LAST_LINE =
  "bottom-0 my-[calc((var(--spacing-row-dense)-var(--spacing-control-xs))/2)] touch:bottom-hit-xs touch:my-[calc((--spacing(11)-var(--spacing-control-xs))/2)]";
// Under touch a wrapped row's lines keep the dense line's height, with a band above the first
// and below the last that makes a one-line row the touch row's 44px, its line in the middle as
// an unwrapped row's. The band is margin on what sits on a line, so a selected key's frame stays
// round its text, and padding inside the value's piece, so the selection's fill covers it.
const LINE_BAND = "touch:my-[calc((--spacing(11)-var(--spacing-row-dense))/2)]";
const PIECE_BAND =
  "touch:py-[calc((--spacing(11)-var(--spacing-row-dense))/2)]";
/** A member row's piece: from the members' indent to the selection's right edge and its ⋯. */
const BLOCK_PIECE = cn(
  EDGE,
  FILL,
  "before:-inset-y-px before:right-[calc(-1*var(--json-slot))] before:left-[calc(var(--json-sel-left)-1px)] after:-top-px after:-bottom-px after:right-[calc(-1*var(--json-slot))] after:left-[calc(var(--json-sel-left)-1px)]",
);
/** Text and controls, above the fills. */
const ABOVE = "relative z-3";
// What the selection covers is lettered in the highlight's text under
// raymond, every token colour included.
const SELECTED_TEXT =
  "raymond:data-in-selection:text-primary-foreground raymond:data-in-selection:**:text-primary-foreground";
/** The keyboard's row, ringed above the selection's fills. */
const FOCUS_RING =
  "after:pointer-events-none after:absolute after:inset-0 after:z-4 after:content-[''] group-focus-visible/json:after:focus-ring-inset";
/** The selection's right edge, which the selected rows' content reaches. */
const REACH_SELECTION = { minWidth: "var(--json-sel-right)" };

export interface RowMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The items, asked for only while the menu is open. */
  items: () => ReactNode;
  onCloseAutoFocus: (event: Event) => void;
}

export interface JsonRowViewProps {
  row: JsonRow;
  id: string;
  index: number;
  start: number;
  wrap: boolean;
  needle: string;
  labels: JsonViewLabels;
  /** The row is inside a selection block, which draws its fill. */
  inBlock: boolean;
  /** The row's own value is selected: its fill starts at the value. */
  valueSelected: boolean;
  /** The selection goes on into the next row. */
  joinsNext: boolean;
  keySelected: boolean;
  focused: boolean;
  /** The row is the one the keyboard and the ⋯ menu follow, or its key is selected: its ⋯ shows. */
  showMenu: boolean;
  menu: RowMenuProps | null;
  measureRef?: Ref<HTMLDivElement>;
}

function MenuButton({
  label,
  menu,
  className,
}: {
  label: string;
  menu: RowMenuProps | null;
  className: string;
}) {
  return (
    <DropdownMenu open={menu?.open ?? false} onOpenChange={menu?.onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          tabIndex={-1}
          aria-label={label}
          data-slot="json-row-menu"
          // A press leaves the focus on the tree.
          onMouseDown={(event) => event.preventDefault()}
          className={cn(ABOVE, "text-muted-foreground", className)}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      {menu?.open && (
        <DropdownMenuContent
          align="end"
          className="w-auto min-w-56"
          onCloseAutoFocus={menu.onCloseAutoFocus}
        >
          {menu.items()}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}

/**
 * The selection's ⋯, inside its frame at the bottom right of the part in view: held to the view's
 * bottom and right edges while the selection runs past them. With a pointer it is 2px taller than
 * a line, and its clear border lies on the frame's, so its ground stays inside the frame.
 */
export function SelectionMenu({
  top,
  height,
  wrap,
  label,
  menu,
}: {
  top: number;
  height: number;
  wrap: boolean;
  label: string;
  menu: RowMenuProps;
}) {
  return (
    <div
      data-slot="json-selection-menu"
      className="pointer-events-none absolute left-0 z-3 flex flex-col items-end justify-end"
      style={{
        top,
        height,
        width: wrap ? "100%" : "calc(var(--json-sel-right) + var(--json-slot))",
      }}
    >
      <MenuButton
        label={label}
        menu={menu}
        className={cn(
          "pointer-events-auto mx-0 mr-0.5 bg-accent touch:mr-hit-xs raymond:bg-primary raymond:text-primary-foreground",
          HELD,
          ON_LAST_LINE,
        )}
      />
    </div>
  );
}

/**
 * The row menu a right-click opens, anchored where it landed: Radix's dropdown menu anchors to
 * its trigger, so a trigger with no size stands at that point.
 */
export function PointMenu({
  point,
  items,
  onClose,
  onCloseAutoFocus,
}: {
  point: { x: number; y: number };
  items: () => ReactNode;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  return (
    <DropdownMenu open onOpenChange={(open) => !open && onClose()}>
      {/* In the body: inside the tree, whose containment holds fixed boxes, it would be placed
          against the tree rather than the window. */}
      {createPortal(
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden
            tabIndex={-1}
            data-slot="json-point-menu-anchor"
            className="pointer-events-none fixed size-0"
            style={{ left: point.x, top: point.y }}
          />
        </DropdownMenuTrigger>,
        document.body,
      )}
      <DropdownMenuContent
        side="bottom"
        align="start"
        sideOffset={0}
        className="w-auto min-w-56"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {items()}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Summary({ row }: { row: JsonNodeRow }) {
  const summary = row.summary;
  if (!summary) return null;
  return (
    <>
      {summary.tags.map((tag, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: tags are positional
          key={i}
          className={cn(
            "ml-1.5",
            tag.emphasis ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {tag.text}
        </span>
      ))}
      {summary.name && (
        <span className="ml-1.5 font-semibold text-foreground">
          {summary.name}
        </span>
      )}
      {summary.args?.map((token, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional
        <span key={`a${i}`} className={TOKEN_CLASS[token.kind]}>
          {token.text}
        </span>
      ))}
      {summary.text && (
        <span className="ml-1.5 text-muted-foreground">"{summary.text}"</span>
      )}
    </>
  );
}

function rowStyle(start: number, wrap: boolean): CSSProperties {
  return {
    top: start,
    lineHeight: wrap ? "var(--spacing-row-dense)" : undefined,
  };
}

const ROW_BASE =
  "group/row absolute left-0 flex cursor-default font-mono text-data select-none";

function JsonRowViewImpl({
  row,
  id,
  index,
  start,
  wrap,
  needle,
  labels,
  inBlock,
  valueSelected,
  joinsNext,
  keySelected,
  focused,
  showMenu,
  menu,
  measureRef,
}: JsonRowViewProps) {
  const layout = wrap
    ? "w-full min-h-row-dense items-start"
    : cn("w-max min-w-full items-center whitespace-nowrap", ROW_HEIGHT_CLASS);
  // The row's content, up to where the ⋯ follows: as wide as it is, or as the selection.
  const content = cn(
    "relative flex self-stretch",
    wrap ? "min-w-0 flex-1 items-start" : "flex-none items-center",
  );
  const reach = inBlock || valueSelected;
  // Under wrap every row's content runs to the ⋯'s room already.
  const reachStyle = reach && !wrap ? REACH_SELECTION : undefined;

  if (row.kind === "comment") {
    return (
      // biome-ignore lint/a11y/useFocusableInteractive: reached through the tree's aria-activedescendant; a focusable row would take a press's focus from the tree
      <div
        ref={measureRef}
        id={id}
        role="treeitem"
        aria-level={row.depth + 1}
        aria-disabled
        aria-selected={false}
        data-row="comment"
        data-index={index}
        data-path={row.path}
        className={cn(ROW_BASE, layout, focused && FOCUS_RING)}
        style={rowStyle(start, wrap)}
      >
        <span
          data-in-selection={inBlock || undefined}
          className={cn(
            content,
            "pr-1.5",
            inBlock && cn(BLOCK_PIECE, joinsNext && JOINS_NEXT),
            SELECTED_TEXT,
          )}
          style={reachStyle}
        >
          <span
            data-part="gutter"
            className="flex-none self-stretch"
            style={{ width: `calc(${indentOf(row.depth)} + 0.875rem)` }}
          />
          <span
            data-end
            className={cn(
              ABOVE,
              "text-muted-foreground",
              wrap &&
                cn("min-w-0 flex-1 break-all whitespace-pre-wrap", LINE_BAND),
            )}
          >
            <Highlight text={row.text} needle={needle} />
          </span>
        </span>
        <span aria-hidden className={cn(SLOT, "w-control-xs")} />
      </div>
    );
  }

  const container = isContainer(row.kind);
  const hasKey = row.key !== null && row.index === null;
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: reached through the tree's aria-activedescendant; a focusable row would take a press's focus from the tree
    <div
      ref={measureRef}
      id={id}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={row.expandable ? row.expanded : undefined}
      aria-selected={inBlock || valueSelected || keySelected}
      data-row="node"
      data-index={index}
      data-path={row.path}
      data-focused={focused || undefined}
      className={cn(
        ROW_BASE,
        layout,
        !inBlock && "can-hover:hover:bg-muted/70 raymond:hover:bg-transparent",
        focused && FOCUS_RING,
      )}
      style={rowStyle(start, wrap)}
    >
      <span
        data-in-selection={inBlock || undefined}
        className={cn(
          content,
          inBlock && cn(BLOCK_PIECE, joinsNext && JOINS_NEXT),
          SELECTED_TEXT,
        )}
        style={reachStyle}
      >
        <span
          data-part="gutter"
          className="flex flex-none items-start justify-end self-stretch"
          style={{ width: `calc(${indentOf(row.depth)} + 0.875rem)` }}
        >
          <span
            data-chevron={row.expandable || undefined}
            className={cn(
              ABOVE,
              // Under wrap the gutter is the row's height, and the touch row's 44px from its
              // top is the first line's.
              "inline-flex h-row-dense w-3.5 flex-none -translate-x-px translate-y-px items-center justify-center text-muted-foreground touch:h-11",
            )}
          >
            {row.expandable && (
              <ChevronRightIcon
                aria-hidden
                className={cn(
                  "size-3 transition-transform motion-reduce:transition-none",
                  row.expanded && "rotate-90",
                )}
              />
            )}
          </span>
        </span>
        {hasKey ? (
          <>
            <span
              data-part="key"
              data-in-selection={keySelected || undefined}
              className={cn(
                "relative flex-none text-primary",
                wrap &&
                  cn("max-w-1/2 break-all whitespace-pre-wrap", LINE_BAND),
                keySelected && cn(KEY_PIECE, "-mx-0.5 px-0.5", SELECTED_TEXT),
              )}
            >
              <span className={ABOVE}>
                <Highlight text={row.key as string} needle={needle} />
              </span>
            </span>
            <span
              data-part="gutter"
              className={cn(
                ABOVE,
                "flex-none text-muted-foreground",
                wrap && LINE_BAND,
              )}
            >
              :&nbsp;
            </span>
          </>
        ) : row.index !== null ? (
          <span
            data-part="gutter"
            className={cn(
              ABOVE,
              "flex-none text-muted-foreground",
              wrap && LINE_BAND,
            )}
          >
            <Highlight text={String(row.index)} needle={needle} />
            :&nbsp;
          </span>
        ) : null}
        <span
          data-in-selection={valueSelected || undefined}
          className={cn(
            "relative flex min-w-0 flex-1 self-stretch pr-1.5",
            wrap ? cn("items-start", PIECE_BAND) : "items-center",
            valueSelected && cn(PIECE, joinsNext && JOINS_NEXT, SELECTED_TEXT),
          )}
        >
          <span
            data-part="value"
            data-end
            className={cn(
              ABOVE,
              VALUE_CLASS[row.kind],
              wrap &&
                (container
                  ? cn("min-w-0 flex-1 truncate", containerTailClass(row))
                  : "min-w-0 flex-1 break-all whitespace-pre-wrap"),
            )}
          >
            {row.mark !== null && (
              <span data-mark className="text-muted-foreground">
                <Highlight text={row.mark} needle={needle} />
                {(row.preview !== "" || row.summary !== null) && <>&nbsp;</>}
              </span>
            )}
            {container ? (
              <>
                <span>{row.preview}</span>
                <Summary row={row} />
              </>
            ) : (
              <Highlight text={row.preview} needle={needle} />
            )}
            {row.truncated && (
              <Badge
                variant="outline"
                className="ml-2 align-middle font-normal text-muted-foreground tabular-nums"
              >
                {labels.chars(formatChars(row.size))}
              </Badge>
            )}
          </span>
          {row.trailing !== null && (
            <span
              data-part="value"
              data-end
              className={cn(
                ABOVE,
                "ml-[2ch] flex-none text-muted-foreground",
                wrap && "min-w-0 shrink break-all whitespace-pre-wrap",
              )}
            >
              <Highlight text={row.trailing} needle={needle} />
            </span>
          )}
        </span>
      </span>
      {reach ? (
        // The selection's own ⋯ stands in this room.
        <span aria-hidden className={cn(SLOT, "w-control-xs")} />
      ) : (
        <MenuButton
          label={labels.rowActions(row.path)}
          menu={menu}
          // After the row's content; held at the view's right edge when the row runs past it,
          // on the ground so the text under it does not show.
          className={cn(
            SLOT,
            HELD,
            "bg-background invisible group-hover/row:visible can-hover:group-hover/row:bg-[color-mix(in_oklab,var(--muted)_70%,var(--background))] aria-expanded:visible touch:visible raymond:can-hover:group-hover/row:bg-background",
            wrap ? cn("self-end", ON_LAST_LINE) : "self-center",
            showMenu && "visible",
          )}
        />
      )}
    </div>
  );
}

export const JsonRowView = memo(JsonRowViewImpl);
