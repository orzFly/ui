import { Button } from "@orz/ui/components/button";

export function YesNoAnswer() {
  return (
    <div className="grid gap-3">
      <p className="font-medium">Revoke the token for ci-runner?</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline">No</Button>
        <Button>Yes</Button>
      </div>
    </div>
  );
}
