import { GroupHeading } from "@orz/ui/components/group-heading";
import { InfoPopover } from "@orz/ui/components/info-popover";
import { Label } from "@orz/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@orz/ui/components/radio-group";

const NOTIFY: { value: string; label: string; info?: string }[] = [
  {
    value: "all",
    label: "All activity",
    info: "Every comment, run and review on what you follow.",
  },
  { value: "mentions", label: "Mentions and assignments" },
  { value: "none", label: "Nothing" },
];

export function NotifyRadioGroup() {
  return (
    <div className="grid gap-3">
      <GroupHeading id="do-notify">Notify me about</GroupHeading>
      <RadioGroup defaultValue="mentions" aria-labelledby="do-notify">
        {NOTIFY.map(({ value, label, info }) => (
          <div key={value} className="flex items-center gap-2">
            <RadioGroupItem value={value} id={`do-notify-${value}`} />
            <div className="flex items-center gap-1">
              <Label htmlFor={`do-notify-${value}`}>{label}</Label>
              {info && (
                <InfoPopover label={`About ${label.toLowerCase()}`}>
                  {info}
                </InfoPopover>
              )}
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
