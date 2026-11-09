import { Pane } from "@orz/ui/components/pane";
import { Loader2Icon } from "lucide-react";

export function PageSpinner() {
  return (
    <Pane
      purpose="document"
      frame="inset"
      role="status"
      className="grid h-32 place-content-center justify-items-center gap-2 text-muted-foreground text-ui"
    >
      <Loader2Icon className="size-6 motion-safe:animate-spin" aria-hidden />
      Loading…
    </Pane>
  );
}
