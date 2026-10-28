import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import { useState } from "react";
import { toast } from "sonner";

const THREAD = INBOX_THREADS.find((thread) => thread.folder === "trash");

export function QuestionDialog() {
  const [open, setOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  if (!THREAD || deleted) {
    return <p className="text-muted-foreground text-sm">Nothing in Trash</p>;
  }
  return (
    <div className="grid min-w-0 gap-3">
      <p className="truncate text-sm">{THREAD.subject}</p>
      <Button
        variant="destructive"
        className="justify-self-start"
        onClick={() => setOpen(true)}
      >
        Delete forever…
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete “${THREAD.subject}” forever?`}
        description="It cannot be restored. To keep it, move it back to the inbox instead."
        confirmLabel="Delete forever"
        destructive
        onConfirm={() => {
          setOpen(false);
          setDeleted(true);
          toast("Conversation deleted forever");
        }}
      />
    </div>
  );
}
