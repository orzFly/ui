import { cn } from "../lib/utils.ts";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-item bg-muted raymond:bg-(--3d-shadow)/30",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
