import { PROFILE, TOKENS } from "@orz/fixtures/account.ts";
import { Button } from "@orz/ui/components/button";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import { KeyRoundIcon } from "lucide-react";

export function AccountSections() {
  return (
    <div className="grid gap-8">
      <section aria-labelledby="spacing-profile" className="grid gap-6">
        <header className="grid gap-1">
          <h3 id="spacing-profile" className="font-medium">
            Profile
          </h3>
          <p className="text-muted-foreground text-ui">
            What others see of you. Saved when you press Save profile.
          </p>
        </header>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="spacing-name">Display name</Label>
            <Input id="spacing-name" defaultValue={PROFILE.name} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="spacing-email">Email</Label>
            <Input
              id="spacing-email"
              type="email"
              defaultValue={PROFILE.email}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline">Discard changes</Button>
          <Button>Save profile</Button>
        </div>
      </section>
      <section aria-labelledby="spacing-tokens" className="grid gap-6">
        <header className="grid gap-1">
          <h3 id="spacing-tokens" className="font-medium">
            Access tokens
          </h3>
          <p className="text-muted-foreground text-ui">
            Tokens that scripts and bots sign in with.
          </p>
        </header>
        <ul className="grid gap-4">
          {TOKENS.map((token) => (
            <li key={token.id} className="flex items-center gap-2">
              <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="grid min-w-0 flex-1">
                <span className="truncate font-mono text-ui">{token.name}</span>
                <span className="truncate text-muted-foreground text-ui-sm">
                  {token.scopes} · {token.lastUsed}
                </span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                aria-label={`Revoke ${token.name}`}
              >
                Revoke…
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
