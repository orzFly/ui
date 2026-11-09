import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { List, ListItem } from "@orz/ui/components/list";
import { EllipsisIcon } from "lucide-react";

const thread = INBOX_THREADS.find(({ id }) => id === "touch-sizes");

export function HoverOnlyRowActions() {
  return (
    <List purpose="collection">
      <ul>
        <ListItem asChild>
          <li className="group flex min-h-row items-center gap-2 px-3 text-ui">
            <span className="min-w-0 flex-1 truncate">{thread?.subject}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`More actions for “${thread?.subject}”`}
              className="opacity-0 group-hover:opacity-100"
            >
              <EllipsisIcon />
            </Button>
          </li>
        </ListItem>
      </ul>
    </List>
  );
}
