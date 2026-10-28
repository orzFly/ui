import { Button } from "@orz/ui/components/button";

export function RemovedFocusRing() {
  return (
    <div>
      <Button variant="outline" className="focus-visible:outline-none">
        Save profile
      </Button>
    </div>
  );
}
