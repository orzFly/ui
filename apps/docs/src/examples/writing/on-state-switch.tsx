import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";

export function OnStateSwitch() {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor="writing-wrap">Wrap long lines</Label>
      <Switch id="writing-wrap" defaultChecked />
    </div>
  );
}
