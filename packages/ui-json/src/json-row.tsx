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

// A selection's fill: the soft accent with a 2px foreground tick while the
// view holds the focus, the muted strip once it does not, the tick kept.
// Under raymond the highlight, white on navy, and the face once the focus
// leaves, as Explorer's tree draws its selected item, with no tick.
export const FILL_CLASS =
  "bg-muted group-focus-within/json:bg-accent raymond:bg-(--3d-face) raymond:group-focus-within/json:bg-primary";
/** The same fill, on a value's own row, where it is drawn by `::before` behind the value. */
const VALUE_FILL_CLASS =
  "before:bg-muted group-focus-within/json:before:bg-accent raymond:before:bg-(--3d-face) raymond:group-focus-within/json:before:bg-primary";
export const TICK_CLASS =
  "after:absolute after:inset-y-0 after:left-0 after:w-0.5 after:bg-foreground after:content-[''] raymond:after:hidden";
// What the selection covers is lettered in the highlight's text under
// raymond, every token colour included, and in the window text once the
// focus leaves.
const SELECTED_TEXT =
  "raymond:data-in-selection:text-foreground raymond:data-in-selection:**:text-foreground raymond:group-focus-within/json:data-in-selection:text-primary-foreground raymond:group-focus-within/json:data-in-selection:**:text-primary-foreground";

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
  keySelected: boolean;
  focused: boolean;
  /** The row is the one the keyboard and the ⋯ menu follow, or is selected: its ⋯ shows. */
  showMenu: boolean;
  menu: RowMenuProps | null;
  measureRef?: Ref<HTMLDivElement>;
}

function RowMenu({
  path,
  labels,
  shown,
  menu,
}: {
  path: string;
  labels: JsonViewLabels;
  shown: boolean;
  menu: RowMenuProps | null;
}) {
  return (
    <DropdownMenu open={menu?.open ?? false} onOpenChange={menu?.onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          tabIndex={-1}
          aria-label={labels.rowActions(path)}
          data-slot="json-row-menu"
          // A press leaves the focus on the tree.
          onMouseDown={(event) => event.preventDefault()}
          className={cn(
            "ml-auto self-center text-muted-foreground invisible group-hover/row:visible aria-expanded:visible touch:visible",
            shown && "visible",
          )}
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
    transform: `translateY(${start}px)`,
    lineHeight: wrap ? "var(--spacing-row-dense)" : undefined,
  };
}

const ROW_BASE =
  "group/row absolute top-0 left-0 flex cursor-default font-mono text-data select-none";

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
  keySelected,
  focused,
  showMenu,
  menu,
  measureRef,
}: JsonRowViewProps) {
  const layout = wrap
    ? "w-full min-h-row-dense items-start touch:min-h-11"
    : cn("w-max min-w-full items-center whitespace-nowrap", ROW_HEIGHT_CLASS);
  const focusRing = focused && "group-focus-visible/json:focus-ring-inset";

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
        data-in-selection={inBlock || undefined}
        className={cn(ROW_BASE, layout, "pr-1.5", SELECTED_TEXT, focusRing)}
        style={rowStyle(start, wrap)}
      >
        <span
          data-part="gutter"
          className="flex-none self-stretch"
          style={{ width: `calc(${indentOf(row.depth)} + 0.875rem)` }}
        />
        <span
          className={cn(
            "text-muted-foreground",
            wrap && "min-w-0 flex-1 break-all whitespace-pre-wrap",
          )}
        >
          <Highlight text={row.text} needle={needle} />
        </span>
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
      data-in-selection={inBlock || undefined}
      className={cn(
        ROW_BASE,
        layout,
        !inBlock && "can-hover:hover:bg-muted/70 raymond:hover:bg-transparent",
        SELECTED_TEXT,
        focusRing,
      )}
      style={rowStyle(start, wrap)}
    >
      <span
        data-part="gutter"
        className="flex flex-none items-start justify-end self-stretch"
        style={{ width: `calc(${indentOf(row.depth)} + 0.875rem)` }}
      >
        <span
          data-chevron={row.expandable || undefined}
          className={cn(
            "inline-flex h-row-dense w-3.5 flex-none -translate-x-px translate-y-px items-center justify-center text-muted-foreground",
            !wrap && "touch:h-11",
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
              wrap && "max-w-1/2 break-all whitespace-pre-wrap",
              keySelected &&
                cn(
                  FILL_CLASS,
                  "-mx-px border-b-2 border-foreground px-px raymond:border-b-0 raymond:outline-1 raymond:-outline-offset-1 raymond:outline-primary-foreground raymond:outline-dotted",
                  SELECTED_TEXT,
                ),
            )}
          >
            <Highlight text={row.key as string} needle={needle} />
          </span>
          <span data-part="gutter" className="flex-none text-muted-foreground">
            :&nbsp;
          </span>
        </>
      ) : row.index !== null ? (
        <span data-part="gutter" className="flex-none text-muted-foreground">
          <Highlight text={String(row.index)} needle={needle} />
          :&nbsp;
        </span>
      ) : null}
      <span
        data-in-selection={valueSelected || undefined}
        className={cn(
          "relative isolate flex min-w-0 flex-1 pr-1.5",
          wrap ? "items-start" : "items-center",
          valueSelected &&
            cn(
              "before:absolute before:inset-0 before:-z-10 before:content-['']",
              VALUE_FILL_CLASS,
              TICK_CLASS,
              SELECTED_TEXT,
            ),
        )}
      >
        <span
          data-part="value"
          className={cn(
            VALUE_CLASS[row.kind],
            wrap &&
              (container
                ? cn("min-w-0 flex-1 truncate", containerTailClass(row))
                : "min-w-0 flex-1 break-all whitespace-pre-wrap"),
          )}
        >
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
            className={cn(
              "ml-[2ch] flex-none text-muted-foreground",
              wrap && "min-w-0 shrink break-all whitespace-pre-wrap",
            )}
          >
            <Highlight text={row.trailing} needle={needle} />
          </span>
        )}
        <RowMenu path={row.path} labels={labels} shown={showMenu} menu={menu} />
      </span>
    </div>
  );
}

export const JsonRowView = memo(JsonRowViewImpl);
