import { Button } from "@orz/ui/components/button";
import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";
import { toast } from "sonner";

export function FirstControls() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Switch id="wrap" defaultChecked />
        <Label htmlFor="wrap">Wrap long lines</Label>
      </div>
      <Button onClick={() => toast("Saved")}>Save</Button>
      <Button variant="outline">Cancel</Button>
    </div>
  );
}
