import { INBOX_LABELS } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import { SearchIcon, SquarePenIcon } from "lucide-react";

export function MailToolbar() {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search, or try is:unread…"
          aria-label="Search mail"
          className="pl-8"
        />
      </div>
      <div className="flex gap-2">
        <Select defaultValue="all">
          <SelectTrigger aria-label="Label" className="flex-1 md:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All labels</SelectItem>
            {INBOX_LABELS.map((label) => (
              <SelectItem key={label} value={label}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button>
          <SquarePenIcon data-icon="inline-start" /> Compose
        </Button>
      </div>
    </div>
  );
}
