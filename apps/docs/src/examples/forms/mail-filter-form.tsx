import { INBOX_LABELS, INBOX_ME, INBOX_PEOPLE } from "@orz/fixtures/inbox.ts";
import { defineQuerySchema, type ValueProviders } from "@orz/query";
import { Button } from "@orz/ui/components/button";
import { Checkbox } from "@orz/ui/components/checkbox";
import { Label } from "@orz/ui/components/label";
import { QueryBox } from "@orz/ui/components/query-box";
import { RadioGroup, RadioGroupItem } from "@orz/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import { Textarea } from "@orz/ui/components/textarea";
import { useRef, useState } from "react";
import { toast } from "sonner";

const SCHEMA = defineQuerySchema({
  qualifiers: {
    from: { value: { kind: "named", source: "person" }, hint: "a login" },
    label: { value: { kind: "named", source: "label" }, hint: "a label" },
    is: {
      value: { kind: "enum", values: ["unread", "read", "starred"] },
      hint: "unread, read or starred",
    },
  },
});

const PROVIDERS: ValueProviders = {
  person: {
    options: Object.entries(INBOX_PEOPLE)
      .filter(([login]) => login !== INBOX_ME)
      .map(([value, hint]) => ({ value, hint })),
  },
  label: { options: INBOX_LABELS.map((value) => ({ value })) },
};

const THEN = [
  { value: "archive", label: "Archive it" },
  { value: "read", label: "Mark it as read" },
  { value: "inbox", label: "Leave it in the Inbox" },
];

export function MailFilterForm() {
  const form = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string>();
  return (
    <form
      ref={form}
      className="grid max-w-md gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (query.trim() === "") {
          setError("Enter a search, like from:ci.");
          document.getElementById("filter-query")?.focus();
          return;
        }
        setError(undefined);
        toast.success("Filter created");
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="filter-query">Matching</Label>
        <QueryBox
          schema={SCHEMA}
          providers={PROVIDERS}
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            if (error && value.trim() !== "") setError(undefined);
          }}
          onSubmit={() => form.current?.requestSubmit()}
          renderSubmitRow={(value, option) => (
            <div {...option}>Use “{value}”</div>
          )}
          listAlign="start"
          inputProps={{
            id: "filter-query",
            placeholder: "from:ci label:release",
            "aria-invalid": error !== undefined,
            "aria-describedby": error ? "filter-query-error" : undefined,
          }}
        />
        {error && (
          <p id="filter-query-error" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label id="filter-then-label">Then</Label>
        <RadioGroup
          defaultValue="archive"
          aria-labelledby="filter-then-label"
          name="then"
        >
          {THEN.map(({ value, label }) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} id={`filter-then-${value}`} />
              <Label htmlFor={`filter-then-${value}`}>{label}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="filter-label">Label it</Label>
        <Select defaultValue="ci" name="label">
          <SelectTrigger id="filter-label" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INBOX_LABELS.map((label) => (
              <SelectItem key={label} value={label}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="filter-reply">
          Reply with <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="filter-reply" name="reply" rows={3} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="filter-existing" name="existing" />
        <Label htmlFor="filter-existing">
          Also apply to conversations that match now
        </Label>
      </div>
      <Button type="submit" className="justify-self-end">
        Create filter
      </Button>
    </form>
  );
}
