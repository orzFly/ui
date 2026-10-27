import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import { PlusIcon, SearchIcon } from "lucide-react";

export function FilterBar() {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Filter runs"
          aria-label="Filter runs"
          className="pl-8"
        />
      </div>
      <div className="flex gap-2">
        <Select defaultValue="all">
          <SelectTrigger aria-label="Status" className="flex-1 md:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="passed">Passed</SelectItem>
          </SelectContent>
        </Select>
        <Button>
          <PlusIcon data-icon="inline-start" /> New run
        </Button>
      </div>
    </div>
  );
}
