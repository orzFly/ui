import { Button } from "@orz/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import { Label } from "@orz/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import { Switch } from "@orz/ui/components/switch";
import { EllipsisIcon, LinkIcon, StarIcon } from "lucide-react";

export function ThreadControls() {
  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate font-medium text-sm">
          Flaky test on touch-sizing
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Star">
          <StarIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Copy link">
          <LinkIcon />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem>Mark as read</DropdownMenuItem>
            <DropdownMenuItem>Move to…</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">Archive</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="thread-watch">Watch this thread</Label>
        <Switch id="thread-watch" defaultChecked />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="thread-notify">Notify me about</Label>
        <Select defaultValue="mentions">
          <SelectTrigger id="thread-notify" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Every reply</SelectItem>
            <SelectItem value="mentions">Mentions</SelectItem>
            <SelectItem value="none">Nothing</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline">Close thread</Button>
        <Button>Reply</Button>
      </div>
    </div>
  );
}
