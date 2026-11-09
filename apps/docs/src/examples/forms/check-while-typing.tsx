import { INBOX_ME, INBOX_PEOPLE } from "@orz/fixtures/inbox.ts";
import { Button } from "@orz/ui/components/button";
import { FieldError } from "@orz/ui/components/field";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import { useState } from "react";

const known = (login: string) => login in INBOX_PEOPLE && login !== INBOX_ME;

export function CheckWhileTyping() {
  const [to, setTo] = useState("ali");
  const wrong = to !== "" && !known(to.trim());
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="typing-to">To</Label>
        <Input
          id="typing-to"
          autoComplete="off"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          aria-invalid={wrong}
          aria-describedby={wrong ? "typing-to-error" : undefined}
        />
        {wrong && (
          <FieldError id="typing-to-error">
            No one here is called {to}.
          </FieldError>
        )}
      </div>
      <Button disabled={!known(to.trim())} className="justify-self-end">
        Send
      </Button>
    </div>
  );
}
