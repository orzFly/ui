import { cn } from "@orz/ui/lib/utils";
import { FileXIcon } from "lucide-react";

/**
 * Where a document links or embeds a file that was deleted: the name it was linked under, struck
 * through, with the word a broken image would otherwise leave the reader to guess.
 */
export function DeletedAttachmentMark({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[min(var(--radius-chip),4px)] border border-dashed px-1.5 text-ui text-muted-foreground",
        className,
      )}
      data-attachment-deleted=""
    >
      <FileXIcon aria-hidden className="size-3.5 shrink-0" />
      <span className="line-through">{name}</span>
      <span>deleted</span>
    </span>
  );
}
