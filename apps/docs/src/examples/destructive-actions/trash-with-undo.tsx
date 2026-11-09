import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { EmptyState } from "@orz/ui/components/empty-state";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const thread = INBOX_THREADS.find(({ id }) => id === "touch-sizes");

export function TrashWithUndo() {
  const [deleted, setDeleted] = useState(false);
  if (deleted) {
    return (
      <EmptyState title="Nothing in Inbox">
        New mail lands here. Archive what you have dealt with.
      </EmptyState>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-ui">{thread?.subject}</span>
      <Button
        variant="outline"
        onClick={() => {
          setDeleted(true);
          toast("Conversation moved to Trash", {
            action: { label: "Undo", onClick: () => setDeleted(false) },
          });
        }}
      >
        <Trash2Icon />
        Delete
      </Button>
    </div>
  );
}
