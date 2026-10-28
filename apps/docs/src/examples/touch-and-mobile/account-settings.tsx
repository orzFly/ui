import { PROFILE, TIME_ZONES } from "@orz/fixtures/account.ts";
import { Button } from "@orz/ui/components/button";
import { Checkbox } from "@orz/ui/components/checkbox";
import { Input } from "@orz/ui/components/input";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orz/ui/components/tabs";
import { toast } from "sonner";

const NOTIFY = [
  { value: "all", label: "All activity" },
  { value: "mentions", label: "Mentions and assignments" },
  { value: "none", label: "Nothing" },
];

export function AccountSettings() {
  return (
    <Tabs defaultValue="profile" className="max-w-md">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">
        <form
          className="grid gap-4 pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            toast.success("Profile saved");
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="touch-name">Display name</Label>
            <Input
              id="touch-name"
              autoComplete="nickname"
              enterKeyHint="done"
              defaultValue={PROFILE.name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="touch-time-zone">Time zone</Label>
            <Select defaultValue={PROFILE.timeZone}>
              <SelectTrigger id="touch-time-zone" className="w-full">
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
            <Checkbox
              id="touch-show-email"
              defaultChecked={PROFILE.showEmail}
            />
            <Label htmlFor="touch-show-email">
              Show my email on my profile
            </Label>
          </div>
          <Button type="submit" className="justify-self-end">
            Save profile
          </Button>
        </form>
      </TabsContent>
      <TabsContent value="notifications" className="grid gap-4 pt-2">
        <div className="grid gap-2">
          <span id="touch-notify" className="font-medium text-sm">
            Notify me about
          </span>
          <RadioGroup aria-labelledby="touch-notify" defaultValue="mentions">
            {NOTIFY.map(({ value, label }) => (
              <div key={value} className="flex items-center gap-2">
                <RadioGroupItem value={value} id={`touch-notify-${value}`} />
                <Label htmlFor={`touch-notify-${value}`}>{label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="touch-email">Send them by email</Label>
          <Switch id="touch-email" defaultChecked />
        </div>
      </TabsContent>
    </Tabs>
  );
}
