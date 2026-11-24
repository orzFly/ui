import { Button } from "@orz/ui/components/button";
import { Checkbox, SelectSlot } from "@orz/ui/components/checkbox";
import { SelectionBar } from "@orz/ui/components/selection-bar";
import { type Selection, useSelection } from "@orz/ui/hooks/use-selection";
import { useSweepSelect } from "@orz/ui/hooks/use-sweep-select";
import { isPlainClick } from "@orz/ui/lib/link";
import { cn } from "@orz/ui/lib/utils";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  PaperclipIcon,
} from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { formatSize, isImageFile } from "../file-kind.ts";
import { fileIcon } from "./icon.ts";
import {
  type FileSource,
  useAttachmentViewer,
  useCanPreview,
  useViewHref,
} from "./viewer.tsx";
import { CHECKER } from "./zoom-canvas.tsx";

export type AttachmentItem = FileSource & {
  key: string | number;
  /** Upload time, as an ISO string; the row prints it when given. */
  createdAt?: string;
};

export type AttachmentListProps = {
  items: AttachmentItem[];
  /** Controls at the end of a row, after its download link: a delete button, say. */
  actions?: (item: AttachmentItem) => ReactNode;
  /** Default "Attachments". */
  title?: ReactNode;
  /** The section's id, for links that jump to it. */
  id?: string;
  /**
   * Whether a long list folds to its newest five. Default true; false keeps every row on screen,
   * for a list whose order is the point (a patch series' numbered files).
   */
  fold?: boolean;
  /**
   * Draw images that have a `url` as thumbnails under the rows rather than as rows. Default
   * false. The viewer still pages through the whole list in its own order.
   */
  thumbnails?: boolean;
  /**
   * Let the reader select files: each row's icon gives way to a checkbox, Shift-click selects a
   * range and a drag down the boxes selects every row it crosses. The header becomes a
   * `SelectionBar`, its paperclip the select-all box. Default false.
   */
  selectable?: boolean;
  /** The selected files' keys, when the app holds them. */
  selected?: AttachmentItem["key"][];
  defaultSelected?: AttachmentItem["key"][];
  onSelectedChange?: (selected: AttachmentItem["key"][]) => void;
  /**
   * The actions on the selected files, in the header while any are: `ToolbarButton`s, a delete
   * that asks first. The list does nothing to the files itself.
   */
  selectionActions?: (items: AttachmentItem[]) => ReactNode;
  className?: string;
};

/** Rows a folded list keeps on screen — its newest end. */
const CAP = 5;
/**
 * Below this many hidden rows, folding is a worse deal than the scroll it
 * saves: the toggle is a row of its own and as tall as one (37px), so hiding
 * one row saves nothing at all and hiding two saves a single row's height,
 * both at the price of a click and of the section changing shape the moment
 * a sixth file arrives.
 */
const MIN_HIDDEN = 3;

// A selected row takes a listbox's picked look, as `ListItem` draws it.
const SELECTED_ROW =
  "data-selected:bg-accent data-selected:text-accent-foreground data-selected:state-cue data-selected:hover:bg-accent raymond:data-selected:bg-primary raymond:data-selected:hover:bg-primary raymond:data-selected:text-primary-foreground raymond:data-selected:[--ring:var(--primary-foreground)] raymond:data-selected:[--foreground:var(--primary-foreground)] raymond:data-selected:[--muted-foreground:var(--primary-foreground)] raymond:data-selected:[--border:var(--primary-foreground)]";

function AttachmentRow({
  items,
  index,
  actions,
  selection,
}: {
  items: AttachmentItem[];
  index: number;
  actions: AttachmentListProps["actions"];
  selection: Selection<AttachmentItem["key"]> | null;
}) {
  const item = items[index] as AttachmentItem;
  const viewer = useAttachmentViewer();
  const canPreview = useCanPreview(item);
  const href = useViewHref(item);
  const [hovered, setHovered] = useState(false);
  const boxId = useId();
  const Icon = fileIcon(item);
  const icon = <Icon className="size-4 shrink-0 text-muted-foreground" />;
  const selected = selection?.isSelected(item.key) ?? false;
  return (
    <li
      data-sweep-key={selection ? String(item.key) : undefined}
      data-selected={selected ? "" : undefined}
      // On touch the touch spacing tall, as a ListItem that holds a control
      // is, so the actions of rows stacked share no tap.
      className={cn(
        "flex items-center hover:bg-muted/40 touch:min-h-touch raymond:hover:bg-transparent",
        SELECTED_ROW,
      )}
      onPointerEnter={(e) => {
        if (selection && e.pointerType !== "touch") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
    >
      {selection && (
        // The label is the hit area: the whole gutter, the row's height,
        // rather than a 16px box beside a link. The icon lives in it, so a
        // tap on the icon selects on touch too.
        <label
          htmlFor={boxId}
          data-sweep-start=""
          className="flex shrink-0 cursor-pointer items-center self-stretch pr-2 pl-3"
        >
          <SelectSlot
            id={boxId}
            icon={icon}
            revealed={hovered}
            aria-label={`select ${item.name}`}
            checked={selected}
            // The click rather than onCheckedChange: only it carries Shift,
            // and Space clicks too.
            onClick={(e) => selection.toggle(item.key, { extend: e.shiftKey })}
          />
        </label>
      )}
      <a
        href={href === "" ? undefined : href}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 py-2 text-ui",
          !selection && "pl-3",
        )}
        onClick={(e) => {
          if (viewer !== null && canPreview && isPlainClick(e)) {
            e.preventDefault();
            viewer.open(items, index);
          }
        }}
      >
        {!selection && icon}
        <span className="truncate font-medium hover:underline">
          {item.name}
        </span>
        {item.size !== undefined && (
          <span className="ml-auto shrink-0 text-ui-sm text-muted-foreground">
            {formatSize(item.size)}
          </span>
        )}
        {/* Hidden below `sm`: the whole section is ~360px there, and
            a third right-hand column would eat the filename, which is
            the one thing on the row nothing else replaces. */}
        {item.createdAt !== undefined && (
          <span
            className="hidden shrink-0 text-ui-sm text-muted-foreground sm:inline"
            title={item.createdAt}
          >
            <time dateTime={item.createdAt}>
              {new Date(item.createdAt).toLocaleString()}
            </time>
          </span>
        )}
      </a>
      {item.url !== undefined && (
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          className="mr-2 ml-1 text-muted-foreground"
        >
          <a
            href={item.url}
            download={item.name}
            aria-label={`download ${item.name}`}
          >
            <DownloadIcon className="size-3.5" />
          </a>
        </Button>
      )}
      {actions?.(item)}
    </li>
  );
}

function AttachmentThumbnail({
  items,
  index,
  selection,
}: {
  items: AttachmentItem[];
  index: number;
  selection: Selection<AttachmentItem["key"]> | null;
}) {
  const item = items[index] as AttachmentItem;
  const viewer = useAttachmentViewer();
  const canPreview = useCanPreview(item);
  const href = useViewHref(item);
  return (
    <div className="flex w-40 min-w-0 flex-col">
      <a
        href={href === "" ? undefined : href}
        className="group flex min-w-0 flex-col gap-1"
        onClick={(e) => {
          if (viewer !== null && canPreview && isPlainClick(e)) {
            e.preventDefault();
            viewer.open(items, index);
          }
        }}
      >
        {/* The checker shows where a transparent image has no pixels, as
            the viewer's canvas does; the image keeps its own proportions. */}
        <span
          className="flex h-24 items-center justify-center overflow-hidden rounded-item ring-1 ring-border group-hover:ring-foreground/40 raymond:rounded-none raymond:p-0.5 raymond:shadow-sunken raymond:ring-0"
          style={{ background: CHECKER }}
        >
          <img
            src={item.url}
            alt=""
            loading="lazy"
            draggable={false}
            className="max-h-full max-w-full object-contain"
          />
        </span>
        <span className="truncate font-medium text-ui-sm group-hover:underline">
          {item.name}
        </span>
      </a>
      <span className="flex items-center gap-1 text-muted-foreground text-ui-sm">
        {selection && (
          <Checkbox
            className="mr-1"
            aria-label={`select ${item.name}`}
            checked={selection.isSelected(item.key)}
            onClick={(e) => selection.toggle(item.key, { extend: e.shiftKey })}
          />
        )}
        {item.size !== undefined && <span>{formatSize(item.size)}</span>}
        {item.url !== undefined && (
          <a
            href={item.url}
            download={item.name}
            aria-label={`download ${item.name}`}
            className="ml-auto p-0.5 hover:text-foreground"
          >
            <DownloadIcon className="size-3.5" />
          </a>
        )}
      </span>
    </div>
  );
}

/**
 * A list of files. Every row is a real link (so copy-link and middle-click
 * keep working), pointing at the provider's `viewHref` — hence the separate
 * download icon, which is the only way left to save a viewable file. A plain
 * click on anything previewable is hijacked into the viewer, anything else
 * falls through to the browser. The viewer pages across the whole list.
 */
export function AttachmentList({
  items,
  actions,
  title = "Attachments",
  id,
  fold = true,
  thumbnails = false,
  selectable = false,
  selected,
  defaultSelected,
  onSelectedChange,
  selectionActions,
  className,
}: AttachmentListProps) {
  // Not persisted anywhere: expanding is "show me now", not a preference.
  const [expanded, setExpanded] = useState(false);
  const keys = useMemo(() => items.map((item) => item.key), [items]);
  const selectionState = useSelection(keys, {
    selected,
    defaultSelected,
    onSelectedChange,
  });
  const selection = selectable ? selectionState : null;
  // A key is a string or a number; the sweep reads it back from the row's
  // attribute as a string.
  const keyOf = useMemo(
    () => new Map(keys.map((key) => [String(key), key])),
    [keys],
  );
  const sweep = useSweepSelect({
    isSelected: selectionState.isSelected,
    paint: selectionState.paint,
    parse: (raw) => keyOf.get(raw) ?? raw,
  });
  if (items.length === 0) return null;

  // Each entry keeps its place in `items`, which is what the viewer pages
  // through, whether it is drawn as a row or as a thumbnail.
  const entries = items.map((item, index) => ({ item, index }));
  const isThumbnail = (item: AttachmentItem) =>
    thumbnails && item.url !== undefined && isImageFile(item);
  const rows = entries.filter(({ item }) => !isThumbnail(item));
  const pictures = entries.filter(({ item }) => isThumbnail(item));

  const collapsible = fold && rows.length >= CAP + MIN_HIDDEN;
  const folded = collapsible && !expanded;
  // The fold takes the head off an unchanged ascending list rather than
  // reversing it: the same array is what the viewer's previous/next page
  // through, and a list that read newest-first here would contradict it.
  const shown = folded ? rows.slice(-CAP) : rows;

  return (
    // Under raymond the list is a list view: a sunken well in the window
    // colour, its title on a band of the face across the top, and its rows
    // on the well unruled, as Explorer's details view draws files.
    <section
      data-selecting={selection && selection.state !== "none" ? "" : undefined}
      className={cn(
        "rounded-frame ring-1 ring-border raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken raymond:ring-0",
        className,
      )}
      id={id}
    >
      {selection ? (
        <SelectionBar
          edge="bottom"
          // The box's cell centres on the rows' icons.
          className="bg-muted/40 px-1"
          count={selection.selected.length}
          total={items.length}
          onSelectAll={selection.toggleAll}
          onClear={selection.clear}
          icon={<PaperclipIcon className="size-3.5 text-muted-foreground" />}
          idle={
            <span className="flex items-center gap-2 px-1">
              <span className="font-medium">{title}</span>
              <span className="text-muted-foreground">{items.length}</span>
            </span>
          }
        >
          {selectionActions?.(
            items.filter((item) => selection.isSelected(item.key)),
          )}
        </SelectionBar>
      ) : (
        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-ui raymond:border-b-0 raymond:bg-(--3d-face)">
          <PaperclipIcon className="size-3.5 text-muted-foreground" />
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground">{items.length}</span>
        </div>
      )}
      {collapsible && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-1 border-b px-3 py-2 text-ui-sm text-muted-foreground touch:min-h-touch hover:bg-muted/40 hover:text-foreground raymond:border-b-0 raymond:hover:bg-transparent"
          data-testid="attachment-fold-toggle"
        >
          {folded ? (
            <>
              <ChevronDownIcon className="size-3.5" />
              Show {rows.length - CAP} more
            </>
          ) : (
            <>
              <ChevronUpIcon className="size-3.5" />
              Show less
            </>
          )}
        </button>
      )}
      {shown.length > 0 && (
        <ul
          className="divide-y raymond:divide-y-0"
          onPointerDownCapture={
            selection ? sweep.onPointerDownCapture : undefined
          }
        >
          {shown.map(({ item, index }) => (
            // The viewer pages through the whole list, so a row hands it its
            // place in `items` — the fold's offset put the first visible row
            // somewhere in the middle.
            <AttachmentRow
              key={item.key}
              items={items}
              index={index}
              actions={actions}
              selection={selection}
            />
          ))}
        </ul>
      )}
      {pictures.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap gap-3 p-3",
            shown.length > 0 && "border-t raymond:border-t-0",
          )}
        >
          {pictures.map(({ item, index }) => (
            <AttachmentThumbnail
              key={item.key}
              items={items}
              index={index}
              selection={selection}
            />
          ))}
        </div>
      )}
    </section>
  );
}
