import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import { InboxIcon, SquarePenIcon, StarIcon, TagIcon } from "lucide-react";

const thread = INBOX_THREADS.find(({ id }) => id === "touch-sizes");

export function IconSizes() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button>
            <SquarePenIcon data-icon="inline-start" />
            Compose
          </Button>
          <Badge variant="outline">
            <TagIcon />
            design
          </Badge>
        </div>
        <p className="flex items-center gap-2 text-sm">
          <InboxIcon className="size-4 text-muted-foreground" />
          Inbox
        </p>
        <div className="grid gap-0.5">
          <p className="truncate text-sm">{thread?.subject}</p>
          <p className="flex items-center gap-1 text-muted-foreground text-xs">
            <StarIcon aria-label="Starred" className="size-3 fill-current" />
            <time dateTime="2026-10-27T10:50:00Z">Oct 27</time>
          </p>
        </div>
      </div>
      <div className="grid content-center justify-items-center gap-2 px-4 py-6 text-center">
        <StarIcon className="size-8 text-muted-foreground" />
        <p className="font-medium text-sm">Nothing in Starred</p>
        <p className="text-muted-foreground text-xs">
          Star a conversation to find it here later.
        </p>
      </div>
    </div>
  );
}
