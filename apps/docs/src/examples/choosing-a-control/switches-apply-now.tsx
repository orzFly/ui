import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";

export function SwitchesApplyNow() {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="do-motion">Reduce motion</Label>
        <Switch id="do-motion" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="do-sounds">Play sounds</Label>
        <Switch id="do-sounds" defaultChecked />
      </div>
    </div>
  );
}
