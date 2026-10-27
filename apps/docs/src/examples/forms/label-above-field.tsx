import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";

export function LabelAboveField() {
  return (
    <div className="grid gap-2">
      <Label htmlFor="do-host">Host</Label>
      <Input id="do-host" placeholder="git.example.com" />
    </div>
  );
}
