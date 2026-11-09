import { Button } from "@orz/ui/components/button";
import { Pane } from "@orz/ui/components/pane";

export function VagueConfirmActions() {
  return (
    <Pane purpose="window" className="grid">
      <Pane purpose="titlebar" className="flex items-center px-3 py-1.5">
        <p className="font-medium text-ui">Are you sure?</p>
      </Pane>
      <div className="grid gap-2 p-3">
        <p className="text-muted-foreground text-ui">
          This action cannot be undone.
        </p>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button variant="outline">Cancel</Button>
          <Button>OK</Button>
        </div>
      </div>
    </Pane>
  );
}
