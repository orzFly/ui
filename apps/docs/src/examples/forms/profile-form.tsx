import {
  PROFILE,
  type Profile,
  sameProfile,
  TIME_ZONES,
} from "@orz/fixtures/account.ts";
import { Button } from "@orz/ui/components/button";
import { Checkbox } from "@orz/ui/components/checkbox";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import { useRef, useState } from "react";
import { toast } from "sonner";

const checkEmail = (email: string) =>
  /^\S+@\S+\.\S+$/.test(email)
    ? undefined
    : "Enter an email address, like alice@example.com.";

export function ProfileForm() {
  const [saved, setSaved] = useState(PROFILE);
  const [draft, setDraft] = useState(PROFILE);
  const [error, setError] = useState<string>();
  const emailRef = useRef<HTMLInputElement>(null);
  const edit = (next: Partial<Profile>) =>
    setDraft((was) => ({ ...was, ...next }));
  return (
    <form
      className="grid max-w-md gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const problem = checkEmail(draft.email);
        setError(problem);
        if (problem) {
          emailRef.current?.focus();
          return;
        }
        setSaved(draft);
        toast.success("Profile saved");
      }}
      onReset={(event) => {
        event.preventDefault();
        const lost = draft;
        setDraft(saved);
        setError(undefined);
        if (sameProfile(lost, saved)) return;
        toast("Changes discarded", {
          action: { label: "Undo", onClick: () => setDraft(lost) },
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="profile-name">Display name</Label>
        <Input
          id="profile-name"
          autoComplete="nickname"
          value={draft.name}
          onChange={(event) => edit({ name: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input
          ref={emailRef}
          id="profile-email"
          type="email"
          autoComplete="email"
          value={draft.email}
          onChange={(event) => {
            edit({ email: event.target.value });
            if (error) setError(checkEmail(event.target.value));
          }}
          aria-invalid={error !== undefined}
          aria-describedby={
            error ? "profile-email-error" : "profile-email-hint"
          }
        />
        {error ? (
          <p id="profile-email-error" className="text-destructive text-sm">
            {error}
          </p>
        ) : (
          <p id="profile-email-hint" className="text-muted-foreground text-sm">
            Notifications go here.
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="profile-time-zone">Time zone</Label>
        <Select
          value={draft.timeZone}
          onValueChange={(timeZone) => edit({ timeZone })}
        >
          <SelectTrigger id="profile-time-zone" className="w-full">
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
          id="profile-show-email"
          checked={draft.showEmail}
          onCheckedChange={(checked) => edit({ showEmail: checked === true })}
        />
        <Label htmlFor="profile-show-email">Show my email on my profile</Label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="reset" variant="outline">
          Discard changes
        </Button>
        <Button type="submit">Save profile</Button>
      </div>
    </form>
  );
}
