import { Button } from "@orz/ui/components/button";

export function CompetingPrimaryActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button>Send</Button>
      <Button>Save draft</Button>
      <Button>Discard</Button>
    </div>
  );
}
