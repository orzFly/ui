import { PROFILE } from "@orz/fixtures/account.ts";
import { Button } from "@orz/ui/components/button";
import { FieldDescription, FieldError } from "@orz/ui/components/field";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import { useRef, useState } from "react";
import { toast } from "sonner";

const check = (email: string) =>
  /^\S+@\S+\.\S+$/.test(email)
    ? undefined
    : "Enter an email address, like alice@example.com.";

export function ProfileEmail() {
  const [email, setEmail] = useState(PROFILE.email);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  return (
    <form
      noValidate
      className="grid max-w-sm gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const problem = check(email);
        setError(problem);
        if (problem) input.current?.focus();
        else toast.success("Profile saved");
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="a11y-email">Email</Label>
        <Input
          ref={input}
          id="a11y-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(check(event.target.value));
          }}
          aria-invalid={error !== undefined}
          aria-describedby={error ? "a11y-email-error" : "a11y-email-hint"}
        />
        {error ? (
          <FieldError id="a11y-email-error">{error}</FieldError>
        ) : (
          <FieldDescription id="a11y-email-hint">
            Notifications go here.
          </FieldDescription>
        )}
      </div>
      <Button type="submit" className="justify-self-start">
        Save profile
      </Button>
    </form>
  );
}
