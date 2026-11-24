import { InfoPopover } from "@orz/ui/components/info-popover";
import { Label } from "@orz/ui/components/label";
import { Separator } from "@orz/ui/components/separator";
import { Switch } from "@orz/ui/components/switch";

const ROWS = [
  { id: "principles-line-numbers", label: "Line numbers", on: true },
  {
    id: "principles-format",
    label: "Format on save",
    on: false,
    info: "Tidies indentation and trailing spaces each time a file is saved.",
  },
  {
    id: "principles-weekly",
    label: "Weekly summary",
    on: true,
    info: "A Monday email of what changed last week, sent even when notifications are off.",
  },
];

export function ExplainedSettings() {
  return (
    <div className="grid">
      {ROWS.map(({ id, label, on, info }, index) => (
        <div key={id}>
          {index > 0 && <Separator />}
          <div className="flex items-center justify-between gap-4 py-3 touch:min-h-touch">
            <div className="flex items-center gap-1">
              <Label htmlFor={id}>{label}</Label>
              {info && (
                <InfoPopover label={`About ${label.toLowerCase()}`}>
                  {info}
                </InfoPopover>
              )}
            </div>
            <Switch id={id} defaultChecked={on} />
          </div>
        </div>
      ))}
    </div>
  );
}
