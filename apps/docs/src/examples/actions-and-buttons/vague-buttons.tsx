import { Button } from "@orz/ui/components/button";

export function VagueButtons() {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline">Reset</Button>
      <Button>Submit</Button>
    </div>
  );
}
