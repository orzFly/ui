import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";

export function SwitchesApplyNow() {
  return (
    <div className="grid gap-3">
      <p className="font-medium text-muted-foreground text-ui-sm">
        Send them by
      </p>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="do-email">Email</Label>
        <Switch id="do-email" defaultChecked />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="do-desktop">Desktop notifications</Label>
        <Switch id="do-desktop" />
      </div>
    </div>
  );
}
