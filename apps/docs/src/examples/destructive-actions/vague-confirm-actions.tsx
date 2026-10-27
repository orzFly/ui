import { Button } from "@orz/ui/components/button";

export function VagueConfirmActions() {
  return (
    <div className="grid gap-3">
      <p className="font-medium text-sm">Are you sure?</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>OK</Button>
      </div>
    </div>
  );
}
