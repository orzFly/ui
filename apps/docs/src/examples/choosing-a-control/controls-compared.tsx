import { LANGUAGES } from "@orz/fixtures/account.ts";
import { INBOX_THREADS } from "@orz/fixtures/inbox.ts";
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
import { ArchiveIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const THREADS = INBOX_THREADS.filter(({ folder }) => folder === undefined)
  .slice(0, 4)
  .map(({ id, subject }) => ({ id, subject }));

const INDENTS = [
  { value: "2", label: "2 spaces" },
  { value: "4", label: "4 spaces" },
  { value: "tab", label: "Tabs" },
];

export function ControlsCompared() {
  const [threads, setThreads] = useState(THREADS);
  const [selected, setSelected] = useState<string[]>([]);
  const all = threads.length > 0 && selected.length === threads.length;
  const archive = () => {
    const before = threads;
    setThreads(threads.filter(({ id }) => !selected.includes(id)));
    setSelected([]);
    toast(
      selected.length === 1
        ? "Conversation archived"
        : `${selected.length} conversations archived`,
      { action: { label: "Undo", onClick: () => setThreads(before) } },
    );
  };
  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
      <div className="grid grid-cols-1 content-start gap-3">
        <p className="font-medium text-ui">Editor</p>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="cc-wrap">Wrap long lines</Label>
          <Switch id="cc-wrap" defaultChecked />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="cc-line-numbers">Show line numbers</Label>
          <Switch id="cc-line-numbers" defaultChecked />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="cc-language">New files open as</Label>
          <Select defaultValue="markdown">
            <SelectTrigger id="cc-language" className="w-36">
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
        <p className="font-medium text-ui" id="cc-indent">
          Indent with
        </p>
        <RadioGroup defaultValue="2" aria-labelledby="cc-indent">
          {INDENTS.map(({ value, label }) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} id={`cc-indent-${value}`} />
              <Label htmlFor={`cc-indent-${value}`}>{label}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      <div className="grid grid-cols-1 content-start gap-3">
        <div className="flex min-h-8 items-center gap-2">
          <Checkbox
            aria-label={selected.length > 0 ? "Select none" : "Select all"}
            checked={all ? true : selected.length > 0 ? "indeterminate" : false}
            onCheckedChange={() =>
              setSelected(
                selected.length > 0 ? [] : threads.map(({ id }) => id),
              )
            }
          />
          <span className="flex-1 font-medium text-ui">
            {selected.length > 0 ? `${selected.length} selected` : "Inbox"}
          </span>
          {selected.length > 0 && (
            <Button variant="outline" size="sm" onClick={archive}>
              <ArchiveIcon />
              Archive
            </Button>
          )}
        </div>
        {threads.map(({ id, subject }) => (
          <div key={id} className="flex items-center gap-2">
            <Checkbox
              id={`cc-${id}`}
              checked={selected.includes(id)}
              onCheckedChange={(checked) =>
                setSelected(
                  checked
                    ? [...selected, id]
                    : selected.filter((each) => each !== id),
                )
              }
            />
            <Label
              htmlFor={`cc-${id}`}
              className="block min-w-0 truncate font-normal"
            >
              {subject}
            </Label>
          </div>
        ))}
        {threads.length === 0 && (
          <div className="grid gap-0.5 text-ui">
            <p className="font-medium">Nothing in Inbox</p>
            <p className="text-muted-foreground">
              New mail lands here. Archive what you have dealt with.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
