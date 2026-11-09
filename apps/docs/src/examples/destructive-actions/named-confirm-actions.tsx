import { Button } from "@orz/ui/components/button";
import { Pane } from "@orz/ui/components/pane";

export function NamedConfirmActions() {
  return (
    <Pane purpose="window" className="grid">
      <Pane purpose="titlebar" className="flex items-center px-3 py-1.5">
        <p className="font-medium text-ui">Delete 3 conversations forever?</p>
      </Pane>
      <div className="grid gap-2 p-3">
        <p className="text-muted-foreground text-ui">
          They cannot be restored. To keep them, move them back to the inbox
          instead.
        </p>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive">Delete 3 conversations</Button>
        </div>
      </div>
    </Pane>
  );
}
