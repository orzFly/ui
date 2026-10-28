import { Button } from "@orz/ui/components/button";

export function NamedButtons() {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline">Discard changes</Button>
      <Button>Save profile</Button>
    </div>
  );
}
