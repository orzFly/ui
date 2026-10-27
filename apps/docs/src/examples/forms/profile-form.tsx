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
import { Textarea } from "@orz/ui/components/textarea";
import { useRef, useState } from "react";
import { toast } from "sonner";

export function ProfileForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const emailRef = useRef<HTMLInputElement>(null);
  return (
    <form
      className="grid max-w-md gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!/^\S+@\S+\.\S+$/.test(email)) {
          setError("Enter an email address, like alice@example.com.");
          emailRef.current?.focus();
          return;
        }
        setError(undefined);
        toast.success("Profile saved");
      }}
      onReset={() => {
        setEmail("");
        setError(undefined);
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="pf-name">Display name</Label>
        <Input id="pf-name" defaultValue="alice" autoComplete="nickname" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pf-email">Email</Label>
        <Input
          ref={emailRef}
          id="pf-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error !== undefined}
          aria-describedby={error ? "pf-email-error" : "pf-email-hint"}
        />
        {error ? (
          <p id="pf-email-error" className="text-destructive text-sm">
            {error}
          </p>
        ) : (
          <p id="pf-email-hint" className="text-muted-foreground text-sm">
            Notifications go here. Nobody else sees it.
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pf-role">Role</Label>
        <Select defaultValue="maintainer">
          <SelectTrigger id="pf-role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="maintainer">Maintainer</SelectItem>
            <SelectItem value="contributor">Contributor</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pf-bio">
          Bio <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="pf-bio" rows={3} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="pf-digest" defaultChecked />
        <Label htmlFor="pf-digest">Send me a weekly summary</Label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="reset" variant="outline">
          Cancel
        </Button>
        <Button type="submit">Save profile</Button>
      </div>
    </form>
  );
}
