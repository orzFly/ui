import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";

export function LabelAboveField() {
  return (
    <div className="grid gap-2">
      <Label htmlFor="do-email">Email</Label>
      <Input
        id="do-email"
        type="email"
        autoComplete="email"
        placeholder="alice@example.com"
      />
    </div>
  );
}
