import { PROFILE } from "@orz/fixtures/account.ts";
import { FieldError } from "@orz/ui/components/field";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";

export function InlineFieldError() {
  return (
    <div className="grid gap-2">
      <Label htmlFor="do-email">Email</Label>
      <Input
        id="do-email"
        type="email"
        defaultValue="alice@example"
        aria-invalid
        aria-describedby="do-email-error"
      />
      <FieldError id="do-email-error">
        Enter an email address, like {PROFILE.email}.
      </FieldError>
    </div>
  );
}
