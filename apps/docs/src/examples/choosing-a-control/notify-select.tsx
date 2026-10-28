import { Label } from "@orz/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";

export function NotifySelect() {
  return (
    <div className="grid gap-3">
      <Label htmlFor="dont-notify">Notify me about</Label>
      <Select defaultValue="mentions">
        <SelectTrigger id="dont-notify" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All activity</SelectItem>
          <SelectItem value="mentions">Mentions and assignments</SelectItem>
          <SelectItem value="none">Nothing</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
