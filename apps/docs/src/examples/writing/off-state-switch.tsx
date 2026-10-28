import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";

export function OffStateSwitch() {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor="writing-no-wrap">Disable line wrapping</Label>
      <Switch id="writing-no-wrap" />
    </div>
  );
}
