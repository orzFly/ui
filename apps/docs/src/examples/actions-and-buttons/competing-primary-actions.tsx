import { Button } from "@orz/ui/components/button";

export function CompetingPrimaryActions() {
  return (
    <div className="flex justify-end gap-2">
      <Button>Save draft</Button>
      <Button>Preview</Button>
      <Button>Publish</Button>
    </div>
  );
}
