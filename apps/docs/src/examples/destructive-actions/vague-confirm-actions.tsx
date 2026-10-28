import { Button } from "@orz/ui/components/button";

export function VagueConfirmActions() {
  return (
    <div className="grid gap-2">
      <p className="font-medium text-sm">Are you sure?</p>
      <p className="text-muted-foreground text-sm">
        This action cannot be undone.
      </p>
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button variant="outline">Cancel</Button>
        <Button>OK</Button>
      </div>
    </div>
  );
}
