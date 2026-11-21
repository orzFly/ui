import { FieldDescription } from "@orz/ui/components/field";
import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";

export function DescribedSetting() {
  return (
    <div className="grid gap-3">
      <FieldDescription>
        How files look while you edit them. Changes apply at once.
      </FieldDescription>
      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-1">
          <Label htmlFor="writing-format-described">Format on save</Label>
          <FieldDescription id="writing-format-described-description">
            Tidies indentation and trailing spaces each time a file is saved.
          </FieldDescription>
        </div>
        <Switch
          id="writing-format-described"
          aria-describedby="writing-format-described-description"
        />
      </div>
    </div>
  );
}
