import { Button } from "@orz/ui/components/button";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import { useState } from "react";
import { toast } from "sonner";

export function DeleteRun() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete run…
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive
        title="Delete run 4182?"
        description="Its log, test report and 3 artifacts are deleted with it. Runs can't be restored."
        confirmLabel="Delete run"
        onConfirm={() => {
          setOpen(false);
          toast("Run 4182 deleted");
        }}
      />
    </div>
  );
}
