import { Skeleton } from "@orz/ui/components/skeleton";

export function SkeletonShapedLikeContent() {
  return (
    <div className="grid gap-4">
      {[0, 1].map((row) => (
        <div key={row} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}
