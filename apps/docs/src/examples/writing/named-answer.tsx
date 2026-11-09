import { Button } from "@orz/ui/components/button";
import { Pane } from "@orz/ui/components/pane";

export function NamedAnswer() {
  return (
    <Pane purpose="window" className="grid">
      <Pane purpose="titlebar" className="flex items-center px-3 py-1.5">
        <p className="font-medium text-ui">Revoke the token for ci-runner?</p>
      </Pane>
      <div className="flex justify-end gap-2 p-3">
        <Button variant="outline">Cancel</Button>
        <Button variant="destructive">Revoke</Button>
      </div>
    </Pane>
  );
}
