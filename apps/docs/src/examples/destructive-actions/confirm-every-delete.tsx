import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import { EmptyState } from "@orz/ui/components/empty-state";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";

const thread = INBOX_THREADS.find(({ id }) => id === "touch-sizes");

export function ConfirmEveryDelete() {
  const [deleted, setDeleted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  if (deleted) {
    return <EmptyState title="Inbox is empty." />;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-ui">{thread?.subject}</span>
      <Button variant="outline" onClick={() => setConfirming(true)}>
        <Trash2Icon />
        Delete
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this conversation?"
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setConfirming(false);
          setDeleted(true);
        }}
      />
    </div>
  );
}
