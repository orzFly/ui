import { Button } from "@orz/ui/components/button";
import { Checkbox } from "@orz/ui/components/checkbox";
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
import { useState } from "react";
import { toast } from "sonner";

const STATUSES = ["Open", "In review", "Closed"];

export function ControlsCompared() {
  const [statuses, setStatuses] = useState(["Open", "In review"]);
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="grid content-start gap-3">
        <p className="font-medium text-sm">Editor</p>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="cc-wrap">Wrap long lines</Label>
          <Switch id="cc-wrap" defaultChecked />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="cc-numbers">Show line numbers</Label>
          <Switch id="cc-numbers" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="cc-language">Language</Label>
          <Select defaultValue="markdown">
            <SelectTrigger id="cc-language" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="markdown">Markdown</SelectItem>
              <SelectItem value="plain">Plain text</SelectItem>
              <SelectItem value="typescript">TypeScript</SelectItem>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="rust">Rust</SelectItem>
              <SelectItem value="go">Go</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="font-medium text-sm" id="cc-density">
          Density
        </p>
        <RadioGroup defaultValue="comfortable" aria-labelledby="cc-density">
          {["Compact", "Comfortable", "Spacious"].map((density) => (
            <div key={density} className="flex items-center gap-2">
              <RadioGroupItem
                value={density.toLowerCase()}
                id={`cc-${density}`}
              />
              <Label htmlFor={`cc-${density}`}>{density}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      <div className="grid content-start gap-3">
        <p className="font-medium text-sm">Filter by status</p>
        {STATUSES.map((status) => (
          <div key={status} className="flex items-center gap-2">
            <Checkbox
              id={`cc-${status}`}
              checked={statuses.includes(status)}
              onCheckedChange={(checked) =>
                setStatuses(
                  checked
                    ? [...statuses, status]
                    : statuses.filter((s) => s !== status),
                )
              }
            />
            <Label htmlFor={`cc-${status}`}>{status}</Label>
          </div>
        ))}
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() => toast(`Showing ${statuses.join(", ") || "nothing"}`)}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
