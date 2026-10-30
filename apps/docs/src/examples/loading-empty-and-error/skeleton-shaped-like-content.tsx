import { NOTE_FOLDERS } from "@orz/fixtures/notes.ts";
import { Skeleton } from "@orz/ui/components/skeleton";

export function SkeletonShapedLikeContent() {
  return (
    <div className="grid grid-cols-[6rem_1fr] overflow-hidden rounded-lg border text-ui">
      <ul className="grid content-start gap-1 border-r bg-muted/40 p-2">
        {NOTE_FOLDERS.map((folder) => (
          <li key={folder} className="truncate px-1.5 py-1">
            {folder}
          </li>
        ))}
      </ul>
      <ul aria-label="Loading notes" className="grid content-start gap-3 p-3">
        {[0, 1, 2].map((row) => (
          <li key={row} className="grid gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40 max-w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
