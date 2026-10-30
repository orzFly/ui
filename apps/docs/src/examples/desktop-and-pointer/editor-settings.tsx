import { LANGUAGES } from "@orz/fixtures/account.ts";
import { Label } from "@orz/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@orz/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import { Switch } from "@orz/ui/components/switch";

const INDENTS = [
  { value: "2", label: "2 spaces" },
  { value: "4", label: "4 spaces" },
  { value: "tab", label: "Tabs" },
];

export function EditorSettings() {
  return (
    <div className="grid max-w-md gap-4">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="keys-wrap">Wrap long lines</Label>
        <Switch id="keys-wrap" defaultChecked />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="keys-line-numbers">Show line numbers</Label>
        <Switch id="keys-line-numbers" defaultChecked />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="keys-language">New files open as</Label>
        <Select defaultValue="markdown">
          <SelectTrigger id="keys-language" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <span id="keys-indent" className="font-medium text-ui">
          Indent with
        </span>
        <RadioGroup aria-labelledby="keys-indent" defaultValue="2">
          {INDENTS.map(({ value, label }) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} id={`keys-indent-${value}`} />
              <Label htmlFor={`keys-indent-${value}`}>{label}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}
