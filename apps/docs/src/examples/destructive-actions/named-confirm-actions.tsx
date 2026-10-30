import { Button } from "@orz/ui/components/button";

export function NamedConfirmActions() {
  return (
    <div className="grid gap-2">
      <p className="font-medium text-ui">Delete 3 conversations forever?</p>
      <p className="text-muted-foreground text-ui">
        They cannot be restored. To keep them, move them back to the inbox
        instead.
      </p>
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button variant="outline">Cancel</Button>
        <Button variant="destructive">Delete 3 conversations</Button>
      </div>
    </div>
  );
}
