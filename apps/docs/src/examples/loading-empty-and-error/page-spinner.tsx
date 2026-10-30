import { Loader2Icon } from "lucide-react";

export function PageSpinner() {
  return (
    <div
      role="status"
      className="grid h-32 place-content-center justify-items-center gap-2 rounded-lg border bg-muted/40 text-muted-foreground text-ui"
    >
      <Loader2Icon className="size-6 motion-safe:animate-spin" aria-hidden />
      Loading…
    </div>
  );
}
