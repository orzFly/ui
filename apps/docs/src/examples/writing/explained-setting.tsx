import { InfoPopover } from "@orz/ui/components/info-popover";
import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";

export function ExplainedSetting() {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1">
        <Label htmlFor="writing-format-info">Format on save</Label>
        <InfoPopover label="About format on save">
          Tidies indentation and trailing spaces each time a file is saved.
        </InfoPopover>
      </div>
      <Switch id="writing-format-info" />
    </div>
  );
}
