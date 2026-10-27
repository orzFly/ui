import { Button } from "@orz/ui/components/button";

export function NamedConfirmActions() {
  return (
    <div className="grid gap-3">
      <p className="font-medium text-sm">Delete 3 files for good?</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button variant="destructive">Delete 3 files</Button>
      </div>
    </div>
  );
}
