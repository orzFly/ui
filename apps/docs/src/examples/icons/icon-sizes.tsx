import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import { EmptyState } from "@orz/ui/components/empty-state";
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
        <p className="flex items-center gap-2 text-ui">
          <InboxIcon className="size-4 text-muted-foreground" />
          Inbox
        </p>
        <div className="grid gap-0.5">
          <p className="truncate text-ui">{thread?.subject}</p>
          <p className="flex items-center gap-1 text-muted-foreground text-ui-sm">
            <StarIcon aria-label="Starred" className="size-3 fill-current" />
            <time dateTime="2026-10-27T10:50:00Z">Oct 27</time>
          </p>
        </div>
      </div>
      <EmptyState
        icon={StarIcon}
        title="Nothing in Starred"
        className="content-center px-4 py-6"
      >
        Star a conversation to find it here later.
      </EmptyState>
    </div>
  );
}
