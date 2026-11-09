import { PROFILE, TOKENS } from "@orz/fixtures/account.ts";
import { Button } from "@orz/ui/components/button";
import {
  GroupDescription,
  GroupHeading,
} from "@orz/ui/components/group-heading";
import { Input } from "@orz/ui/components/input";
import { Label } from "@orz/ui/components/label";
import { List, ListItem } from "@orz/ui/components/list";
import { KeyRoundIcon } from "lucide-react";

export function AccountSections() {
  return (
    <div className="grid gap-8">
      <section aria-labelledby="spacing-profile" className="grid gap-6">
        <header className="grid gap-1">
          <GroupHeading asChild>
            <h3 id="spacing-profile">Profile</h3>
          </GroupHeading>
          <GroupDescription>
            What others see of you. Saved when you press Save profile.
          </GroupDescription>
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
          <GroupHeading asChild>
            <h3 id="spacing-tokens">Access tokens</h3>
          </GroupHeading>
          <GroupDescription>
            Tokens that scripts and bots sign in with.
          </GroupDescription>
        </header>
        <List purpose="collection">
          <ul>
            {TOKENS.map((token) => (
              <ListItem key={token.id} asChild>
                <li className="flex min-h-row items-center gap-2 py-2">
                  <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate font-mono text-ui">
                      {token.name}
                    </span>
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
              </ListItem>
            ))}
          </ul>
        </List>
      </section>
    </div>
  );
}
