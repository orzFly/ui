import { isPlainLeftClick } from "@orz/ui/components/link-chip";
import { cn } from "@orz/ui/lib/utils";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  PaperclipIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { formatSize } from "../file-kind.ts";
import { fileIcon } from "./icon.ts";
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
  /** Default "Attachments". */
  title?: ReactNode;
  /** The section's id, for links that jump to it. */
  id?: string;
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
}: {
  items: AttachmentItem[];
  index: number;
}) {
  const item = items[index] as AttachmentItem;
  const viewer = useAttachmentViewer();
  const canPreview = useCanPreview(item);
  const href = useViewHref(item);
  const Icon = fileIcon(item);
  return (
    <li className="flex items-center hover:bg-muted/40">
      <a
        href={href === "" ? undefined : href}
        className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 text-sm"
        onClick={(e) => {
          if (viewer !== null && canPreview && isPlainLeftClick(e)) {
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
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {formatSize(item.size)}
          </span>
        )}
        {/* Hidden below `sm`: the whole section is ~360px there, and
            a third right-hand column would eat the filename, which is
            the one thing on the row nothing else replaces. */}
        {item.createdAt !== undefined && (
          <span
            className="hidden shrink-0 text-xs text-muted-foreground sm:inline"
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
    </li>
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
  title = "Attachments",
  id,
  className,
}: AttachmentListProps) {
  // Not persisted anywhere: expanding is "show me now", not a preference.
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const collapsible = items.length >= CAP + MIN_HIDDEN;
  const folded = collapsible && !expanded;
  // The fold takes the head off an unchanged ascending list rather than
  // reversing it: the same array is what the viewer's previous/next page
  // through, and a list that read newest-first here would contradict it.
  const shown = folded ? items.slice(-CAP) : items;
  const hiddenBefore = items.length - shown.length;

  return (
    <section className={cn("rounded-lg border", className)} id={id}>
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-sm">
        <PaperclipIcon className="size-3.5 text-muted-foreground" />
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">{items.length}</span>
      </div>
      {collapsible && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-1 border-b px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          data-testid="attachment-fold-toggle"
        >
          {folded ? (
            <>
              <ChevronDownIcon className="size-3.5" />
              Show {items.length - CAP} more
            </>
          ) : (
            <>
              <ChevronUpIcon className="size-3.5" />
              Show less
            </>
          )}
        </button>
      )}
      <ul className="divide-y">
        {shown.map((item, shownIndex) => (
          // The viewer pages through the whole list, so a row hands it its
          // place in `items` — the fold's offset put the first visible row
          // somewhere in the middle.
          <AttachmentRow
            key={item.key}
            items={items}
            index={shownIndex + hiddenBefore}
          />
        ))}
      </ul>
    </section>
  );
}
