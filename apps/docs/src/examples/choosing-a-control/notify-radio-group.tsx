import { FieldDescription } from "@orz/ui/components/field";
import { GroupHeading } from "@orz/ui/components/group-heading";
import { Label } from "@orz/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@orz/ui/components/radio-group";

const NOTIFY = [
  {
    value: "all",
    label: "All activity",
    description: "Every comment, run and review on what you follow.",
  },
  {
    value: "mentions",
    label: "Mentions and assignments",
    description: "Only what asks for you by name.",
  },
  { value: "none", label: "Nothing", description: "Check in when you like." },
];

export function NotifyRadioGroup() {
  return (
    <div className="grid gap-3">
      <GroupHeading id="do-notify">Notify me about</GroupHeading>
      <RadioGroup defaultValue="mentions" aria-labelledby="do-notify">
        {NOTIFY.map(({ value, label, description }) => (
          <div key={value} className="flex items-start gap-2">
            <RadioGroupItem
              value={value}
              id={`do-notify-${value}`}
              aria-describedby={`do-notify-${value}-description`}
              className="mt-0.5"
            />
            <div className="grid gap-1">
              <Label htmlFor={`do-notify-${value}`}>{label}</Label>
              <FieldDescription id={`do-notify-${value}-description`}>
                {description}
              </FieldDescription>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
