import { PROFILE, TIME_ZONES } from "@orz/fixtures/account.ts";
import { Button } from "@orz/ui/components/button";
import { Checkbox } from "@orz/ui/components/checkbox";
import { Label } from "@orz/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import { toast } from "sonner";

export function ProfileChoices() {
  return (
    <form
      className="grid max-w-md gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        toast.success("Profile saved");
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="pc-time-zone">Time zone</Label>
        <Select defaultValue={PROFILE.timeZone}>
          <SelectTrigger id="pc-time-zone" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_ZONES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="pc-show-email" defaultChecked={PROFILE.showEmail} />
        <Label htmlFor="pc-show-email">Show my email on my profile</Label>
      </div>
      <Button type="submit" className="justify-self-end">
        Save profile
      </Button>
    </form>
  );
}
