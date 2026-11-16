import { isPlainClick } from "@orz/ui/lib/link";
import { cn } from "@orz/ui/lib/utils";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  PaperclipIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { formatSize, isImageFile } from "../file-kind.ts";
import { fileIcon } from "./icon.ts";
import { CHECKER } from "./image-canvas.tsx";
import {
  type FileSource,
  useAttachmentViewer,
  useCanPreview,
  useViewHref,
} from "./viewer.tsx";

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

function AttachmentRow({
  items,
  index,
  actions,
}: {
  items: AttachmentItem[];
  index: number;
  actions: AttachmentListProps["actions"];
}) {
  const item = items[index] as AttachmentItem;
  const viewer = useAttachmentViewer();
  const canPreview = useCanPreview(item);
  const href = useViewHref(item);
  const Icon = fileIcon(item);
  return (
    <li className="flex items-center hover:bg-muted/40 raymond:hover:bg-transparent">
      <a
        href={href === "" ? undefined : href}
        className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 text-ui"
        onClick={(e) => {
          if (viewer !== null && canPreview && isPlainClick(e)) {
            e.preventDefault();
            viewer.open(items, index);
          }
        }}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
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
        <a
          href={item.url}
          download={item.name}
          aria-label={`download ${item.name}`}
          className="shrink-0 py-2 pr-3 pl-2 text-muted-foreground hover:text-foreground"
        >
          <DownloadIcon className="size-3.5" />
        </a>
      )}
      {actions?.(item)}
    </li>
  );
}

function AttachmentThumbnail({
  items,
  index,
}: {
  items: AttachmentItem[];
  index: number;
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
  className,
}: AttachmentListProps) {
  // Not persisted anywhere: expanding is "show me now", not a preference.
  const [expanded, setExpanded] = useState(false);
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
      className={cn(
        "rounded-frame ring-1 ring-border raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken raymond:ring-0",
        className,
      )}
      id={id}
    >
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-ui raymond:border-b-0 raymond:bg-(--3d-face)">
        <PaperclipIcon className="size-3.5 text-muted-foreground" />
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">{items.length}</span>
      </div>
      {collapsible && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-1 border-b px-3 py-2 text-ui-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground raymond:border-b-0 raymond:hover:bg-transparent"
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
        <ul className="divide-y raymond:divide-y-0">
          {shown.map(({ item, index }) => (
            // The viewer pages through the whole list, so a row hands it its
            // place in `items` — the fold's offset put the first visible row
            // somewhere in the middle.
            <AttachmentRow
              key={item.key}
              items={items}
              index={index}
              actions={actions}
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
            <AttachmentThumbnail key={item.key} items={items} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}
