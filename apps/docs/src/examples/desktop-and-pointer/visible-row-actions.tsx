import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { EllipsisIcon } from "lucide-react";

const thread = INBOX_THREADS.find(({ id }) => id === "touch-sizes");

export function VisibleRowActions() {
  return (
    <div className="flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm">
      <span className="min-w-0 flex-1 truncate">{thread?.subject}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`More actions for “${thread?.subject}”`}
      >
        <EllipsisIcon />
      </Button>
    </div>
  );
}
