import { Button } from "@orz/ui/components/button";
import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";

export function SwitchesInAForm() {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="dont-show-email">Show my email on my profile</Label>
        <Switch id="dont-show-email" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="dont-weekly">Weekly summary</Label>
        <Switch id="dont-weekly" defaultChecked />
      </div>
      <Button className="justify-self-end">Save profile</Button>
    </div>
  );
}
