import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const thread = INBOX_THREADS.find(({ id }) => id === "touch-sizes");

export function TrashWithUndo() {
  const [deleted, setDeleted] = useState(false);
  if (deleted) {
    return (
      <div className="grid gap-0.5 text-ui">
        <p className="font-medium">Nothing in Inbox</p>
        <p className="text-muted-foreground">
          New mail lands here. Archive what you have dealt with.
        </p>
      </div>
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
