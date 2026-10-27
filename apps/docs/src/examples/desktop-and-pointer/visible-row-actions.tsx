import { Button } from "@orz/ui/components/button";
import { EllipsisIcon } from "lucide-react";

export function VisibleRowActions() {
  return (
    <div className="flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm">
      <span className="min-w-0 flex-1 truncate">build on master</span>
      <Button variant="ghost" size="icon-xs" aria-label="More actions">
        <EllipsisIcon />
      </Button>
    </div>
  );
}
