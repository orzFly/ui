import { Button } from "@orz/ui/components/button";
import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";

export function SwitchesInAForm() {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="dont-digest">Subscribe to the digest</Label>
        <Switch id="dont-digest" defaultChecked />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="dont-terms">Accept the terms</Label>
        <Switch id="dont-terms" />
      </div>
      <Button className="justify-self-end">Save</Button>
    </div>
  );
}
