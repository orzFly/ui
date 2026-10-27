import { Button } from "@orz/ui/components/button";

export function OnePrimaryAction() {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline">Save draft</Button>
      <Button>Publish</Button>
    </div>
  );
}
