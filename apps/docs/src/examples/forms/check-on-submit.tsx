import { INBOX_ME, INBOX_PEOPLE } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import { useRef, useState } from "react";
import { toast } from "sonner";

function checkRecipients(to: string) {
  const logins = to
    .split(",")
    .map((login) => login.trim())
    .filter(Boolean);
  if (logins.length === 0) return "Add at least one recipient.";
  const unknown = logins.filter(
    (login) => !(login in INBOX_PEOPLE) || login === INBOX_ME,
  );
  return unknown.length > 0
    ? `No one here is called ${unknown.join(", ")}. Try alice, bot-one, claude-agent.`
    : undefined;
}

export function CheckOnSubmit() {
  const [to, setTo] = useState("");
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  return (
    <form
      className="grid gap-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const problem = checkRecipients(to);
        setError(problem);
        if (problem) input.current?.focus();
        else toast("Message sent");
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="check-to">To</Label>
        <Input
          ref={input}
          id="check-to"
          autoComplete="off"
          placeholder="alice, newcomer"
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            if (error) setError(checkRecipients(event.target.value));
          }}
          aria-invalid={error !== undefined}
          aria-describedby={error ? "check-to-error" : undefined}
        />
        {error && (
          <p id="check-to-error" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" className="justify-self-end">
        Send
      </Button>
    </form>
  );
}
